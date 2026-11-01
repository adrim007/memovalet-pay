import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";

// The model side of MemoValet's assistants. The model plans; every fact and action goes through the
// tools it is handed, which the caller wires to an MCP server. It runs on Gemini when a GEMINI_API_KEY
// is set (Google's free tier works) and on Claude otherwise, like lib/ai/provider.

export class AssistantProviderError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "AssistantProviderError"; }
}

export type McpTool = { name: string; description?: string; inputSchema: Record<string, unknown> };
export type ToolResult = { text: string; data?: Record<string, unknown>; isError: boolean };
export type CallTool = (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
export type ModelTurn = { reply: string; messages: unknown[] };

export function assistantProvider() {
  const configured = process.env.MEMOVALET_AI_PROVIDER?.trim().toLowerCase();
  if (configured === "anthropic" || configured === "claude") return "anthropic";
  if (configured === "gemini" || configured === "google") return "gemini";
  return process.env.GEMINI_API_KEY ? "gemini" : "anthropic";
}

// Spoken replies and captions carry no dashes, even if the model slips one in.
export function withoutDashes(text: string) {
  return text.replace(/\s*[—–]\s*/g, ", ").replace(/(?<=\w)-(?=\w)/g, " ").replace(/\s-\s/g, ", ");
}

export function runModelTurn(provider: string, system: string, history: unknown[], text: string, tools: McpTool[], callTool: CallTool): Promise<ModelTurn> {
  return provider === "gemini"
    ? geminiTurn(system, history as GeminiContent[], text, tools, callTool)
    : claudeTurn(system, history as Anthropic.Beta.BetaMessageParam[], text, tools, callTool);
}

async function claudeTurn(system: string, history: Anthropic.Beta.BetaMessageParam[], text: string, tools: McpTool[], callTool: CallTool) {
  const runnable = tools.map(tool => {
    const inputSchema = { ...tool.inputSchema };
    delete inputSchema.$schema;
    return betaTool({
      name: tool.name,
      description: tool.description ?? tool.name,
      inputSchema: { ...inputSchema, type: "object" } as { type: "object" },
      run: async input => (await callTool(tool.name, input as Record<string, unknown>)).text,
    });
  });
  const runner = new Anthropic().beta.messages.toolRunner({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    system,
    output_config: { effort: "low" },
    cache_control: { type: "ephemeral" },
    // Server side fallback: if a request is declined, the API reruns it on a suitable model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    tools: runnable,
    messages: [...history, { role: "user", content: text }],
    max_iterations: 8,
  });
  const final = await runner;
  const reply = final.stop_reason === "refusal"
    ? "Sorry, I can't help with that one."
    : final.content.filter(block => block.type === "text").map(block => block.text).join(" ").trim();
  return { reply, messages: [...runner.params.messages] };
}

type GeminiPart = {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

// Gemini accepts a subset of JSON Schema for function parameters, so keep only those keys.
const GEMINI_SCHEMA_KEYS = new Set(["type", "description", "enum", "properties", "required", "items", "nullable", "minItems", "maxItems"]);
function geminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!GEMINI_SCHEMA_KEYS.has(key)) continue;
    if (key === "properties") {
      out.properties = Object.fromEntries(Object.entries(value as Record<string, Record<string, unknown>>).map(([name, child]) => [name, geminiSchema(child)]));
    } else if (key === "items") out.items = geminiSchema(value as Record<string, unknown>);
    else out[key] = value;
  }
  return out;
}

// Gemini says it is busy with a 429 or 503, usually only for a moment, so a model request gets two more
// tries. Only the model request repeats here: a tool that already ran is never run again.
const BUSY_STATUS = new Set([429, 503]);
const BUSY_WAIT_MS = Number(process.env.GEMINI_BUSY_WAIT_MS) || 1500;

async function geminiRequest(model: string, body: string) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body,
      signal: AbortSignal.timeout(45000),
    });
    if (attempt === 2 || !BUSY_STATUS.has(response.status)) return response;
    await new Promise(resolve => setTimeout(resolve, BUSY_WAIT_MS * (attempt + 1)));
  }
}

async function geminiTurn(system: string, history: GeminiContent[], text: string, tools: McpTool[], callTool: CallTool) {
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
  const functionDeclarations = tools.map(tool => {
    const parameters = geminiSchema(tool.inputSchema);
    const hasParameters = Object.keys((parameters.properties as object | undefined) ?? {}).length > 0;
    return { name: tool.name, description: tool.description ?? tool.name, ...(hasParameters ? { parameters: { ...parameters, type: "object" } } : {}) };
  });
  // Model turns go back exactly as received, which keeps Gemini's thought signatures intact.
  const contents: GeminiContent[] = [...history, { role: "user", parts: [{ text }] }];
  for (let step = 0; step < 8; step++) {
    const response = await geminiRequest(model, JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      ...(/^gemini-3(?:\.|$|-)/i.test(model) ? { generationConfig: { thinkingConfig: { thinkingLevel: "low" } } } : {}),
    }));
    const data = await response.json().catch(() => ({})) as {
      error?: { message?: string };
      candidates?: { finishReason?: string; content?: { parts?: GeminiPart[] } }[];
    };
    if (!response.ok) throw new AssistantProviderError(response.status, data.error?.message ?? "Gemini request failed");
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts?.length) {
      return { reply: "Sorry, I couldn't work that out. Could you say it another way?", messages: contents.slice(0, -1) };
    }
    contents.push({ role: "model", parts });
    const calls = parts.filter(part => part.functionCall);
    if (calls.length === 0) {
      return { reply: parts.filter(part => part.text && !part.thought).map(part => part.text).join(" ").trim(), messages: contents };
    }
    const responses: GeminiPart[] = [];
    for (const part of calls) {
      const { name, args } = part.functionCall!;
      const result = await callTool(name, args ?? {});
      responses.push({ functionResponse: { name, response: result.data && !result.isError ? result.data : { error: result.text } } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { reply: "Sorry, that took too many steps. Could you try again?", messages: contents };
}
