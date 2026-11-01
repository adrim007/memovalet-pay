import { NextResponse } from "next/server";
import { TokenVerifier } from "livekit-server-sdk";
import { AIProviderError, generateAIText } from "@/lib/ai/provider";
import { createClient } from "@/lib/supabase/server";
import { getLiveSessionPublic } from "@/lib/database";
import { SPEECH_LANGUAGE_OPTIONS } from "@/lib/speechRecognition";
import { buildTranslationPrompt } from "@/lib/translation-prompt";
import { buildBatchTranslationPrompt, parseBatchTranslations, readBatchLines } from "@/lib/translation-batch";

// A batch of the meeting so far can take longer than one line.
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // The call's own pass first: it is checked here with our own secret, with
    // no network call at all. Asking Supabase who this is, on every line of a
    // live conversation, was costing a round trip to Tokyo before the
    // translation had even started.
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    const claims = token && key && secret
      ? await new TokenVerifier(key, secret).verify(token).catch(() => null)
      : null;
    const inThisCall = Boolean(claims?.video?.roomJoin && claims.video.room === body.sessionId);
    if (!inThisCall) {
      // Anywhere else in MemoValet — a saved meeting, the transcript page.
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const session = typeof body.sessionId === "string" ? await getLiveSessionPublic(body.sessionId) : null;
        if (!session || session.status === "ended") return NextResponse.json({ error: "Join an active session or sign in to translate captions" }, { status: 401 });
      }
    }
    const targetLanguage =
      typeof body.targetLanguage === "string" ? body.targetLanguage.trim() : "";
    const languages = SPEECH_LANGUAGE_OPTIONS.map((option) => option.label);

    // Everything said before translation was switched on, a batch at a time
    // (see lib/translation-batch).
    if (body.lines !== undefined) {
      const lines = readBatchLines(body.lines, languages);
      if (!lines || !languages.includes(targetLanguage)) {
        return NextResponse.json({ error: "lines and targetLanguage are required" }, { status: 400 });
      }
      const characters = lines.reduce((sum, line) => sum + line.text.length, 0);
      const answer = await generateAIText({
        prompt: buildBatchTranslationPrompt({ lines, targetLanguage }),
        // Room for every line to come back, in scripts that take more tokens.
        maxTokens: Math.min(8000, 400 + Math.ceil(characters * 1.5)),
        json: true,
      });
      return NextResponse.json({ translations: parseBatchTranslations(answer, lines.length) });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text || text.length > 3000 || !SPEECH_LANGUAGE_OPTIONS.some(option => option.label === targetLanguage)) {
      return NextResponse.json({ error: "text and targetLanguage are required" }, { status: 400 });
    }

    // The language spoken, when the call page knows it, so slang in the line
    // can be read properly (see lib/translation-style).
    const sourceLanguage =
      typeof body.sourceLanguage === "string" &&
      SPEECH_LANGUAGE_OPTIONS.some((option) => option.label === body.sourceLanguage.trim())
        ? body.sourceLanguage.trim()
        : null;

    // How this speaker has been taken so far in the call, if the page said.
    const register = body.register === "formal" || body.register === "informal" ? body.register : null;
    const prompt = buildTranslationPrompt({ text, targetLanguage, sourceLanguage, register });

    const translated = await generateAIText({
      prompt,
      // A line of speech, not an essay: a cap that can't slow a long answer down.
      maxTokens: 700,
    });

    return NextResponse.json({ translation: translated });
  } catch (error) {
    console.error("Live translation failed", error);
    // Too many at once: worth waiting a moment and asking again.
    if (error instanceof AIProviderError && error.category === "provider_rate_limit") {
      return NextResponse.json(
        { code: "TRANSLATION_BUSY", error: "Translation is busy. Trying again in a moment." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        code: "TRANSLATION_UNAVAILABLE",
        error: "Live translation is temporarily unavailable. Original captions will continue.",
      },
      { status: 503 }
    );
  }
}
