import { AIProviderError, categoryFor } from "./provider";

/**
 * Speech to text for a short piece of one person's microphone, on MemoValet's
 * side rather than in their browser (see speech-segments for why).
 *
 * Gemini, the same service and key that write meeting summaries. The audio is
 * a few seconds of one speaker, sent once and not kept.
 */

/** Some models answer silence with a stage direction instead of nothing. */
const NOT_SPEECH = /^[\s[(]*(no speech|no audible speech|silence|inaudible|music|noise|background noise|unintelligible|blank audio)[\s\])]*\.?$/i;

export function cleanTranscript(text: unknown): string {
  if (typeof text !== "string") return "";
  const trimmed = text.replace(/\s+/g, " ").trim();
  return NOT_SPEECH.test(trimmed) ? "" : trimmed.slice(0, 4000);
}

export function transcriptionPrompt(languageLabel: string | null): string {
  return [
    "Transcribe the speech in this audio clip from a live meeting, word for word.",
    languageLabel
      ? `The speaker chose ${languageLabel} as their language; if they speak another language, write it in that language.`
      : "Write it in whatever language is spoken.",
    "Do not translate, summarise, correct, explain or add anything, and leave out filler sounds like \"um\".",
    "If there is no clear speech, the text is an empty string.",
    'Also name the language spoken, in English, as "language".',
    'Reply only with JSON: {"text": "...", "language": "..."}',
  ].join(" ");
}

export interface Transcription {
  text: string;
  /** The language the speaker actually used, as the model heard it. */
  language: string | null;
}

export async function transcribeSpeech(options: {
  audio: Uint8Array;
  mimeType: string;
  languageLabel: string | null;
  timeoutMs?: number;
}): Promise<Transcription> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIProviderError("gemini", "provider_or_configuration");

  const model =
    process.env.GEMINI_TRANSCRIBE_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
  const thinkingConfig = /^gemini-3(?:\.|$)/i.test(model) ? { thinkingLevel: "minimal" } : { thinkingBudget: 0 };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: options.mimeType, data: Buffer.from(options.audio).toString("base64") } },
                { text: transcriptionPrompt(options.languageLabel) },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0,
            thinkingConfig,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      }
    );
    const data = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; status?: string };
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (!response.ok) {
      throw new AIProviderError(
        "gemini",
        categoryFor(response.status, `${data.error?.status || ""} ${data.error?.message || ""}`),
        response.status
      );
    }
    const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
    if (!raw) return { text: "", language: null };
    try {
      const answer = JSON.parse(raw) as { text?: unknown; language?: unknown };
      return {
        text: cleanTranscript(answer.text),
        language: typeof answer.language === "string" ? answer.language.trim().slice(0, 40) : null,
      };
    } catch {
      // Not JSON after all: take it as the words, unless it is plainly not.
      return { text: raw.startsWith("{") ? "" : cleanTranscript(raw), language: null };
    }
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new AIProviderError("gemini", "provider_timeout");
    throw new AIProviderError("gemini", "provider_or_configuration");
  } finally {
    clearTimeout(timeout);
  }
}
