import { reserveTranscription, refundTranscription } from "@/lib/plan-access";
import { wavSeconds } from "@/lib/wav-duration";
import { NextResponse } from "next/server";
import { TokenVerifier } from "livekit-server-sdk";
import { getLiveSessionPublic } from "@/lib/database";
import { AIProviderError } from "@/lib/ai/provider";
import { transcribeSpeech } from "@/lib/ai/transcribe";
import { AUTO_LANGUAGE, languageLabelFor, SPEECH_LANGUAGE_OPTIONS } from "@/lib/speechRecognition";
import { takesSpeech } from "@/lib/live-transcription";

export const maxDuration = 30;

/** Twenty seconds of 16 kHz speech is about 640 KB; leave room, refuse anything bigger. */
const MAX_AUDIO_BYTES = 1024 * 1024;
const MIN_AUDIO_BYTES = 44 + 3200; // a WAV header and a tenth of a second

// Words for one short piece of one person's microphone, for the live captions
// and the saved transcript (see lib/speech-segments for why this exists).
//
// Guests join calls by link without an account, so an account can't be the
// gate. The call's own pass is: the LiveKit token this room handed out, signed
// with our secret and naming this room. Only someone let into this call, while
// it is still running (or just ended, see live-transcription), can have speech
// transcribed here.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const { id } = await params;

  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) return NextResponse.json({ error: "Calls aren't configured" }, { status: 500 });
  if (!token) return NextResponse.json({ error: "Join the call first" }, { status: 401 });
  const claims = await new TokenVerifier(key, secret).verify(token).catch(() => null);
  if (!claims?.video?.roomJoin || claims.video.room !== id) {
    return NextResponse.json({ error: "Join the call first" }, { status: 403 });
  }

  const session = await getLiveSessionPublic(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (!takesSpeech(session, Date.now())) return NextResponse.json({ error: "This meeting has ended." }, { status: 410 });

  if (!req.headers.get("content-type")?.toLowerCase().startsWith("audio/wav")) {
    return NextResponse.json({ error: "Send the sound as WAV" }, { status: 415 });
  }
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Too long a piece of sound" }, { status: 413 });
  const audio = new Uint8Array(await req.arrayBuffer());
  if (audio.length > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Too long a piece of sound" }, { status: 413 });
  if (audio.length < MIN_AUDIO_BYTES) return NextResponse.json({ text: "" });

  const code = new URL(req.url).searchParams.get("lang") || "";
  // No language picked: the speaker asked us to work it out (see AUTO_LANGUAGE).
  const languageLabel =
    code === AUTO_LANGUAGE ? null : SPEECH_LANGUAGE_OPTIONS.find((option) => option.code === code)?.label ?? null;

  let seconds: number;
  try { seconds = wavSeconds(audio); }
  catch { return NextResponse.json({ error: "Send a valid short WAV audio clip" }, { status: 400 }); }
  let reservation: string | null;
  try { reservation = await reserveTranscription(id, seconds); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Transcription is unavailable", category: "allowance" }, { status: 402 }); }
  try {
    const said = await transcribeSpeech({ audio, mimeType: "audio/wav", languageLabel });
    return NextResponse.json(
      { text: said.text, language: languageLabelFor(said.language) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    await refundTranscription(reservation).catch(() => {});
    const category = error instanceof AIProviderError ? error.category : "provider_or_configuration";
    // Only the category — never the audio, the words or the key.
    console.error("Live transcription failed", { category, status: error instanceof AIProviderError ? error.status : null });
    const status = category === "provider_rate_limit" ? 429 : 503;
    return NextResponse.json({ error: "Transcription is busy. Try again shortly.", category }, { status });
  }
}
