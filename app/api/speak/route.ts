import { createClient } from "@/lib/supabase/server";
import { synthesizeSpeech } from "@/lib/ai/speech";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Spoken replies for the dashboard search bar. Signed in people get Gemini's natural voice for up to
// REPLIES_PER_DAY replies a day, counted in the database; past that, or if anything here fails, the
// page uses the browser's own voice instead, so a reply is never lost.
const REPLIES_PER_DAY = 40;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

    const body = await request.json().catch(() => null) as { text?: unknown } | null;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 400) return Response.json({ error: "Nothing to say." }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return Response.json({ error: "The natural voice isn't set up." }, { status: 503 });

    const { data: allowed, error } = await supabase.rpc("claim_spoken_reply", { p_limit: REPLIES_PER_DAY });
    if (error) return Response.json({ error: "The natural voice isn't available right now." }, { status: 503 });
    if (allowed !== true) return Response.json({ error: "Today's natural voice limit is reached." }, { status: 429 });

    const audio = await synthesizeSpeech(text);
    if (!audio) return Response.json({ error: "The voice isn't available right now." }, { status: 502 });
    return new Response(audio, { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "The natural voice isn't available right now." }, { status: 503 });
  }
}
