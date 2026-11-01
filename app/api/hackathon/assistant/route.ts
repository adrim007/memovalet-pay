import Anthropic from "@anthropic-ai/sdk";
import { AssistantProviderError, runAssistantTurn } from "@/lib/hackathon/assistant";
import { mcpOriginAllowed } from "@/lib/mcp/follow-through-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  // Like the preview pages, this sample assistant (which calls a paid model) is off in production.
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRODUCT_PREVIEW !== "1") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (!mcpOriginAllowed(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  // Without a model key the assistant can't think, so say exactly what to add.
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "No AI key is set. Add GEMINI_API_KEY to .env.local, then restart the app." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { conversationId?: unknown; text?: unknown; confirmStart?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 500) return Response.json({ error: "Say or type a short request." }, { status: 400 });
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId.slice(0, 64) : undefined;
  // A tapped time comes with its exact start; spoken or typed choices are read by the approval gate.
  const confirmStart = typeof body?.confirmStart === "string" ? body.confirmStart.slice(0, 64) : undefined;

  try {
    const turn = await runAssistantTurn({ origin: new URL(request.url).origin, conversationId, text, confirmStart });
    return Response.json(turn, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AssistantProviderError) {
      console.error("Assistant model request failed", error.status, error.message);
      if (error.status === 429) return Response.json({ error: "The assistant is busy. Try again in a moment." }, { status: 429 });
      if (error.status === 400 && /api key/i.test(error.message) || error.status === 401 || error.status === 403) {
        return Response.json({ error: "The AI key was rejected. Check the key in .env.local." }, { status: 503 });
      }
      return Response.json({ error: "The assistant couldn't answer just now." }, { status: 502 });
    }
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: "The assistant is busy. Try again in a moment." }, { status: 429 });
    if (error instanceof Anthropic.AuthenticationError) return Response.json({ error: "The AI key was rejected. Check the key in .env.local." }, { status: 503 });
    if (error instanceof Anthropic.APIError) return Response.json({ error: "The assistant couldn't answer just now." }, { status: 502 });
    console.error("Assistant turn failed", error);
    return Response.json({ error: "The assistant couldn't reach MemoValet." }, { status: 502 });
  }
}
