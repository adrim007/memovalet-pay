import Anthropic from "@anthropic-ai/sdk";

export type AIProvider = "gemini" | "anthropic";
export type AIErrorCategory =
  | "provider_authentication"
  | "provider_billing"
  | "provider_rate_limit"
  | "provider_timeout"
  | "provider_or_configuration"
  | "invalid_output";

interface GenerateAITextOptions {
  prompt: string;
  system?: string;
  maxTokens: number;
  timeoutMs?: number;
  json?: boolean;
}

export class AIProviderError extends Error {
  constructor(
    public readonly provider: AIProvider,
    public readonly category: AIErrorCategory,
    public readonly status: number | null = null
  ) {
    super("AI request failed");
    this.name = "AIProviderError";
  }
}

function selectedProvider(): AIProvider {
  const configured = process.env.MEMOVALET_AI_PROVIDER?.trim().toLowerCase();
  if (configured === "anthropic" || configured === "claude") return "anthropic";
  if (configured === "gemini" || configured === "google") return "gemini";
  return process.env.GEMINI_API_KEY ? "gemini" : "anthropic";
}

export function hasConfiguredAIProvider(): boolean {
  return selectedProvider() === "gemini"
    ? Boolean(process.env.GEMINI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

export function categoryFor(status: number | null, message = ""): AIErrorCategory {
  if (/credit balance|billing|insufficient credit/i.test(message)) return "provider_billing";
  if (status === 401 || status === 403 || /api key.*invalid|invalid.*api key/i.test(message)) {
    return "provider_authentication";
  }
  if (status === 429 || /rate limit|resource_exhausted|quota exceeded/i.test(message)) {
    return "provider_rate_limit";
  }
  return "provider_or_configuration";
}

async function generateWithGemini(options: GenerateAITextOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIProviderError("gemini", "provider_or_configuration");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45000);
  try {
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
    const thinkingConfig = /^gemini-3(?:\.|$)/i.test(model)
      ? { thinkingLevel: "minimal" }
      : { thinkingBudget: 0 };
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
          contents: [{ role: "user", parts: [{ text: options.prompt }] }],
          generationConfig: {
            maxOutputTokens: options.maxTokens,
            temperature: 0.2,
            thinkingConfig,
            ...(options.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: controller.signal,
      }
    );
    const data = await response.json().catch(() => ({})) as {
      error?: { message?: string; status?: string };
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    if (!response.ok) {
      throw new AIProviderError("gemini", categoryFor(response.status, `${data.error?.status || ""} ${data.error?.message || ""}`), response.status);
    }
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
    if (!text || (candidate?.finishReason && candidate.finishReason !== "STOP")) {
      throw new AIProviderError("gemini", "invalid_output");
    }
    return text;
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIProviderError("gemini", "provider_timeout");
    }
    throw new AIProviderError("gemini", "provider_or_configuration");
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithAnthropic(options: GenerateAITextOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AIProviderError("anthropic", "provider_or_configuration");
  try {
    const anthropic = new Anthropic({ apiKey, timeout: options.timeoutMs ?? 45000, maxRetries: 0 });
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5",
      max_tokens: options.maxTokens,
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: "user", content: options.prompt }],
    });
    const text = message.content.filter((part) => part.type === "text").map((part) => part.text).join("").trim();
    if (message.stop_reason !== "end_turn" || !text) {
      throw new AIProviderError("anthropic", "invalid_output");
    }
    return text;
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    const failure = error as { status?: number; message?: string } | null;
    throw new AIProviderError(
      "anthropic",
      categoryFor(typeof failure?.status === "number" ? failure.status : null, failure?.message),
      typeof failure?.status === "number" ? failure.status : null
    );
  }
}

export async function generateAIText(options: GenerateAITextOptions): Promise<string> {
  return selectedProvider() === "gemini"
    ? generateWithGemini(options)
    : generateWithAnthropic(options);
}

export function getAIErrorDetails(error: unknown): {
  provider: AIProvider | "unknown";
  category: AIErrorCategory;
  status: number | null;
} {
  if (error instanceof AIProviderError) {
    return { provider: error.provider, category: error.category, status: error.status };
  }
  if (error instanceof SyntaxError) {
    return { provider: selectedProvider(), category: "invalid_output", status: null };
  }
  return { provider: selectedProvider(), category: "provider_or_configuration", status: null };
}
