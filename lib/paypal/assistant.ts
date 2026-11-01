import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { assistantProvider, runModelTurn, withoutDashes, type CallTool, type McpTool } from "@/lib/ai/toolLoop";

// MemoValet Pay's assistant. The model reads the meeting and proposes the invoice through MemoValet
// Pay's own MCP server, which it reaches as an ordinary MCP client. It can never approve money going
// out: the approval token from the person's Approve tap is added to send_invoice here, on the turn
// they tapped, and the model never sees it.

const SYSTEM = `You are MemoValet, an AI assistant that helps a small studio follow through on what was agreed in client meetings. This is a fictional sample workspace for a demo. The user runs Bright Lane Studio. Every invoice goes to the PayPal sandbox, which uses test money only.

How to work:
* Use the MemoValet tools for every fact. Never invent a payer, amount, currency, email, date or invoice ID.
* When the user wants to bill what was agreed, call propose_invoice. Then say the invoice is ready for them to check and approve on the card. Never call send_invoice in that same turn.
* Only the person can approve money going out, by tapping Approve on the card. When their message says they approved it, call send_invoice once with the proposalId from propose_invoice. If you don't have it, call propose_invoice first.
* If send_invoice is refused, tell the person why in plain words. Never retry it with changed details.
* To check whether an invoice is paid, call invoice_status with its invoice ID. If it is unpaid and past its due date, call draft_payment_reminder and say the reminder is a draft that hasn't been sent.

How to talk:
* Warm, plain English, like a capable colleague. One to three short sentences, under 40 words. No lists, markdown, emoji or tool names.
* The cards on the screen show the details, so mention only the one thing that matters and the next step.
* Never use any dash character. Write amounts like A$500 and dates like Tuesday 3 November.`;

export type PayCard = { tool: string; data: Record<string, unknown> };
export type PayTurn = { conversationId: string; reply: string; cards: PayCard[] };

// The model is shown send_invoice without its approvalToken field, so it has nothing to fill in or guess.
export function toolsForModel(tools: McpTool[]): McpTool[] {
  return tools.map(tool => {
    if (tool.name !== "send_invoice") return tool;
    const schema = tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    const properties = { ...(schema.properties ?? {}) };
    delete properties.approvalToken;
    return { ...tool, inputSchema: { ...tool.inputSchema, properties, required: (schema.required ?? []).filter(key => key !== "approvalToken") } };
  });
}

// Whatever token the model passes is dropped; only the one from this turn's Approve tap goes to the server.
export function argsForServer(name: string, args: Record<string, unknown>, approvalToken?: string) {
  if (name !== "send_invoice") return args;
  const rest = { ...args };
  delete rest.approvalToken;
  return approvalToken ? { ...rest, approvalToken } : rest;
}

type Conversation = { provider: string; messages: unknown[]; touched: number };
const conversations = new Map<string, Conversation>();
const KEEP_MS = 2 * 60 * 60 * 1000;

function remember(id: string, provider: string, messages: unknown[]) {
  const now = Date.now();
  for (const [key, value] of conversations) if (now - value.touched > KEEP_MS) conversations.delete(key);
  conversations.set(id, { provider, messages, touched: now });
}

export async function runPayAssistantTurn(options: {
  origin: string;
  conversationId?: string;
  text: string;
  approvalToken?: string; // only on the turn the person tapped Approve
}): Promise<PayTurn> {
  const using = assistantProvider();
  const saved = options.conversationId ? conversations.get(options.conversationId) : undefined;
  const same = saved && saved.provider === using;
  const conversationId = same ? options.conversationId! : crypto.randomUUID();

  const mcp = new Client({ name: "MemoValet Pay assistant", version: "1.0.0" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL("/api/paypal/mcp", options.origin)));
  try {
    const cards: PayCard[] = [];
    const tools = toolsForModel((await mcp.listTools()).tools as McpTool[]);
    const callTool: CallTool = async (name, args) => {
      const result = await mcp.callTool({ name, arguments: argsForServer(name, args, options.approvalToken) }, undefined, { timeout: 20000 });
      const data = result.structuredContent as Record<string, unknown> | undefined;
      if (!result.isError && data) cards.push({ tool: name, data });
      const text = (result.content as { type: string; text?: string }[] | undefined)?.find(block => block.type === "text")?.text;
      return { text: text ?? JSON.stringify(data ?? {}), data, isError: Boolean(result.isError) };
    };
    const turn = await runModelTurn(using, SYSTEM, same ? saved.messages : [], options.text, tools, callTool);
    remember(conversationId, using, turn.messages);
    return { conversationId, reply: withoutDashes(turn.reply || "Done. The details are on the screen."), cards };
  } finally {
    await mcp.close();
  }
}
