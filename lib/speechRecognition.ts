export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
}

export function readSpeechResult(event: SpeechRecognitionEventLike) {
  const final: string[] = [];
  const interim: string[] = [];
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const text = result[0]?.transcript?.trim();
    if (text) (result.isFinal ? final : interim).push(text);
  }
  return { finalText: final.join(" "), interimText: interim.join(" ") };
}

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeechRecognition {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;

  const w = window as unknown as WindowWithSpeechRecognition;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface SpeechLanguageOption {
  code: string;
  label: string;
}

export const SPEECH_LANGUAGE_OPTIONS: SpeechLanguageOption[] = [
  { code: "en-US", label: "English" },
  { code: "ar-SA", label: "Arabic" },
  { code: "zh-HK", label: "Cantonese" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "he-IL", label: "Hebrew" },
  { code: "hi-IN", label: "Hindi" },
  { code: "it-IT", label: "Italian" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "ms-MY", label: "Malay" },
  { code: "zh-CN", label: "Mandarin" },
  { code: "ru-RU", label: "Russian" },
  { code: "si-LK", label: "Sinhala" },
  { code: "es-ES", label: "Spanish" },
  { code: "sw-KE", label: "Swahili" },
  { code: "fil-PH", label: "Tagalog" },
  { code: "ta-IN", label: "Tamil" },
  { code: "th-TH", label: "Thai" },
  { code: "tr-TR", label: "Turkish" },
  { code: "yo-NG", label: "Yoruba" },
];

/**
 * "Work out what is being spoken" — what the call page sends when nobody has
 * set their language by hand, which is the usual case. Never shown to anyone:
 * detection is what happens by default, not something to choose.
 */
export const AUTO_LANGUAGE = "auto";

// Two letters at the front of a browser's language tag, to one of ours. Chinese
// depends on the region: Hong Kong and Macau speak Cantonese, elsewhere Mandarin.
const BY_LANGUAGE: Record<string, string> = {
  en: "en-US", ar: "ar-SA", fr: "fr-FR", de: "de-DE", he: "he-IL", iw: "he-IL",
  hi: "hi-IN", it: "it-IT", ja: "ja-JP", ko: "ko-KR", ms: "ms-MY", ru: "ru-RU",
  si: "si-LK", es: "es-ES", sw: "sw-KE", fil: "fil-PH", tl: "fil-PH", ta: "ta-IN",
  th: "th-TH", tr: "tr-TR", yo: "yo-NG", yue: "zh-HK",
};

/**
 * The caption language that matches the device, so nobody has to find their own
 * language in a list before a call can be any use. English only when the device
 * says English, or when its language is one MemoValet doesn't caption.
 */
export function browserCaptionLanguage(tags: readonly string[] | undefined): string | null {
  for (const tag of tags ?? []) {
    if (typeof tag !== "string") continue;
    const [language, region] = tag.toLowerCase().split("-");
    if (language === "zh") return region === "hk" || region === "mo" ? "zh-HK" : "zh-CN";
    const code = BY_LANGUAGE[language];
    if (code) return code;
  }
  return null;
}

/**
 * The name a speech service gives a language ("Arabic", "modern standard
 * arabic", "English (Australia)") as one of ours, or null when it is a language
 * MemoValet doesn't list.
 */
export function languageLabelFor(detected: unknown): string | null {
  if (typeof detected !== "string") return null;
  const said = detected.trim().toLowerCase();
  if (!said) return null;
  const match = SPEECH_LANGUAGE_OPTIONS.find((option) => {
    const label = option.label.toLowerCase();
    return said === label || said.startsWith(`${label} `) || said.endsWith(` ${label}`) || said.includes(label);
  });
  return match?.label ?? null;
}
