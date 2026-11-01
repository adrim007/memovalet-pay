import { NextResponse } from "next/server";
import { TokenVerifier } from "livekit-server-sdk";
import { getLiveSessionPublic } from "@/lib/database";
import { takesSpeech } from "@/lib/live-transcription";

/**
 * What captions are doing in someone's browser, as a single word.
 *
 * Captions failing shows up as an empty panel and nothing else: no request is
 * made, so the server sees nothing at all, and the one person who can see what
 * happened is the person in the call. These breadcrumbs are the difference
 * between guessing and knowing.
 *
 * Never any speech, text, or who was talking — only which of a fixed set of
 * things happened, and the same LiveKit pass the rest of the call uses.
 */
const EVENTS = new Set([
  "browser-captions-started",
  "memovalet-captions-started",
  "switched-to-memovalet",
  "browser-captions-error",
  "heard-nothing",
  "first-words",
  "captions-stopped",
  "no-microphone",
  "language-detected",
  "translation-on",
  "translation-off",
  "reading-language",
  "speaking-language-set",
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const { id } = await params;
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret || !token) return NextResponse.json({ ok: false }, { status: 401 });
  const claims = await new TokenVerifier(key, secret).verify(token).catch(() => null);
  if (!claims?.video?.roomJoin || claims.video.room !== id) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const session = await getLiveSessionPublic(id);
  if (!session || !takesSpeech(session, Date.now())) return NextResponse.json({ ok: false }, { status: 410 });

  const body = (await req.json().catch(() => null)) as { event?: unknown; detail?: unknown } | null;
  const event = typeof body?.event === "string" && EVENTS.has(body.event) ? body.event : null;
  if (!event) return NextResponse.json({ ok: false }, { status: 400 });
  // A word from the fixed list above, and at most a short tag with it.
  const detail = typeof body?.detail === "string" ? body.detail.replace(/[^a-z0-9 .:_-]/gi, "").slice(0, 60) : "";
  console.log("[captions]", event, detail, `room=${id.slice(0, 8)}`);
  return NextResponse.json({ ok: true });
}
