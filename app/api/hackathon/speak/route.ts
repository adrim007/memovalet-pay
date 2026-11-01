import { synthesizeSpeech } from "@/lib/ai/speech";
import { mcpOriginAllowed } from "@/lib/mcp/follow-through-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Gemini's natural voice for the simulated Alexa+ replies, using the same free GEMINI_API_KEY as the
// assistant. The page falls back to the browser's own voice whenever this is slow or unavailable.
export async function POST(request: Request) {
  // Like the assistant it speaks for, this sample voice is off in production.
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRODUCT_PREVIEW !== "1") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (!mcpOriginAllowed(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "No Gemini key is set." }, { status: 503 });

  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 400) return Response.json({ error: "Nothing to say." }, { status: 400 });

  const audio = await synthesizeSpeech(text);
  if (!audio) return Response.json({ error: "The voice isn't available right now." }, { status: 502 });
  return new Response(audio, { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, no-store" } });
}
