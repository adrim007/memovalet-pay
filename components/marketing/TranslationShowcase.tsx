import Link from "next/link";
import { ArrowRight, CheckCircle, Translate } from "@phosphor-icons/react/dist/ssr";
import { SPEECH_LANGUAGE_OPTIONS } from "@/lib/speechRecognition";

/**
 * Meetings, as one of the assistant's skills: live translation, shown rather
 * than described. This is the home page's meeting section — MemoValet is a
 * personal assistant, not a meeting app, so meetings get this one place, not
 * the headline.
 *
 * The languages are read from the same list the call page offers, so this
 * can never advertise one that isn't there. The example lines are real
 * sentences with real translations — Spanish, Japanese and French only, where
 * the wording can be checked — not filler in scripts nobody proofread.
 */
const LINES = [
  {
    speaker: "Sofía",
    language: "Spanish",
    time: "10:02",
    original: "¿Podemos mover la entrega al jueves? Vamos un poco justos.",
    translated: "Can we move the delivery to Thursday? We're cutting it a bit fine.",
    tone: null,
    colour: "from-amber-300 to-orange-400",
  },
  {
    speaker: "Kenji",
    language: "Japanese",
    time: "10:02",
    original: "大丈夫です。木曜日なら間に合います。",
    translated: "That's fine. Thursday works for us.",
    tone: "Polite tone kept",
    colour: "from-sky-300 to-indigo-400",
  },
  {
    speaker: "Camille",
    language: "French",
    time: "10:03",
    original: "Parfait, je préviens l'équipe tout de suite.",
    translated: "Perfect, I'll let the team know right away.",
    tone: null,
    colour: "from-fuchsia-300 to-pink-400",
  },
];

const POINTS = [
  "Works out which language each person is speaking. Nothing to set up.",
  "Understands slang and everyday expressions, not just textbook phrases.",
  "Keeps the tone: formal stays formal, casual stays casual.",
  "Switch it on mid-meeting and everything already said is translated too.",
  "When the call ends, the summary and action items go straight to your tasks.",
];

export default function TranslationShowcase() {
  return (
    <section aria-labelledby="translation-heading" className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28">
      <div className="pointer-events-none absolute right-[-10rem] top-1/4 h-[32rem] w-[32rem] rounded-full bg-fuchsia-500/10 blur-[150px]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8071ff]">When you meet</p>
          <h2 id="translation-heading" className="mt-5 font-display text-3xl font-light leading-[1.16] tracking-[-0.045em] text-balance text-white sm:text-5xl">
            Everyone speaks their language.
            <span className="block text-[#bb99ff]">Everyone reads theirs.</span>
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/62">
            When you need to talk something through, MemoValet is your note-taker and interpreter. It works out what each person is speaking and translates every line into the language you read, while they are still talking.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-[15px] leading-6 text-white/78">
                <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-[#a78bfa]" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/resources/supported-languages"
            className="mt-9 inline-flex items-center gap-2 text-sm font-semibold text-[#c1adfa] transition hover:gap-3 hover:text-white"
          >
            See all {SPEECH_LANGUAGE_OPTIONS.length} languages <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </Link>
        </div>

        <div>
          {/* A still of the caption panel, built from the same parts. */}
          <figure
            aria-label="Example: a meeting in three languages, translated into English"
            className="relative rounded-[28px] border border-white/12 bg-[#11101f]/80 p-2 shadow-[0_40px_120px_-40px_rgba(119,85,239,0.55)] backdrop-blur-xl"
          >
            <div className="rounded-[22px] border border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-transparent">
              <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#7755ef]/20 text-[#c1adfa]">
                  <Translate size={18} weight="bold" aria-hidden="true" />
                </span>
                <span className="flex-1 whitespace-nowrap text-sm font-semibold text-white">Live translation</span>
                <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/75">
                  <span className="hidden sm:inline">Reading in </span>English
                </span>
              </div>
              <ol className="divide-y divide-white/[0.06] px-5">
                {LINES.map((line) => (
                  <li key={line.speaker} className="py-4">
                    <div className="flex items-center gap-2.5 text-xs">
                      <span className={`h-6 w-6 shrink-0 rounded-full bg-gradient-to-br ${line.colour}`} aria-hidden="true" />
                      <span className="font-semibold text-white">{line.speaker}</span>
                      <span className="text-white/45">{line.language}</span>
                      {line.tone && (
                        <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                          {line.tone}
                        </span>
                      )}
                      <time className="ml-auto tabular-nums text-white/35">{line.time}</time>
                    </div>
                    <p className="mt-2 text-[15px] leading-6 text-white">{line.translated}</p>
                    <p lang={line.language === "Spanish" ? "es" : line.language === "Japanese" ? "ja" : "fr"} className="mt-1 text-[13px] leading-5 text-white/45">
                      {line.original}
                    </p>
                  </li>
                ))}
                <li className="flex items-center gap-2.5 py-4 text-xs text-white/50" aria-hidden="true">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a78bfa]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a78bfa] [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a78bfa] [animation-delay:300ms]" />
                  </span>
                  Listening…
                </li>
              </ol>
            </div>
          </figure>

          <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Supported languages">
            {SPEECH_LANGUAGE_OPTIONS.map((language) => (
              <li
                key={language.code}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60 transition hover:border-[#8071ff]/50 hover:text-white"
              >
                {language.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
