"use client";

import { useRef, useState } from "react";
import ResultsDisplay from "@/components/ResultsDisplay";
import { MeetingResult } from "@/lib/types";
import { SPEECH_LANGUAGE_OPTIONS } from "@/lib/speechRecognition";

export default function MeetingLanguageSwitcher({
  meetingId,
  original,
  transcript,
}: {
  meetingId: string;
  original: MeetingResult;
  transcript: string;
}) {
  const [language, setLanguage] = useState("");
  const [translated, setTranslated] = useState<MeetingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summaryCache] = useState<Map<string, MeetingResult>>(() => new Map());

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [translatedTranscript, setTranslatedTranscript] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState("");
  const [transcriptCache] = useState<Map<string, string>>(() => new Map());
  const requestVersion = useRef(0);

  const fetchTranscript = async (value: string) => {
    const version = requestVersion.current;
    if (!value) {
      setTranslatedTranscript(null);
      return;
    }
    const cached = transcriptCache.get(value);
    if (cached) {
      setTranslatedTranscript(cached);
      return;
    }
    setTranscriptLoading(true);
    setTranscriptError("");
    try {
      const response = await fetch(`/api/meetings/${meetingId}/translate-transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to translate");
      transcriptCache.set(value, data.transcript);
      if (version === requestVersion.current) setTranslatedTranscript(data.transcript);
    } catch (err) {
      if (version === requestVersion.current) setTranscriptError(err instanceof Error ? err.message : "Couldn't translate the transcript.");
    } finally {
      if (version === requestVersion.current) setTranscriptLoading(false);
    }
  };

  const handleChange = async (value: string) => {
    requestVersion.current += 1;
    setTranslatedTranscript(null);
    setTranscriptError("");
    setTranscriptLoading(false);
    setLanguage(value);
    setError("");
    setTranslated(null);

    if (!value) {
      setTranslated(null);
      setTranslatedTranscript(null);
      return;
    }

    const cached = summaryCache.get(value);
    if (cached) {
      setTranslated(cached);
    } else {
      setLoading(true);
      try {
        const response = await fetch(`/api/meetings/${meetingId}/translate-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetLanguage: value }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to translate");
        summaryCache.set(value, data);
        setTranslated(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't translate the summary, mind trying again?"
        );
        setLanguage("");
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    if (transcriptOpen) {
      fetchTranscript(value);
    }
  };

  const handleToggleTranscript = () => {
    const next = !transcriptOpen;
    setTranscriptOpen(next);
    if (next && language) {
      fetchTranscript(language);
    }
  };

  if (!original.meeting_summary && !transcript) return null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-end gap-2 mb-3">
          <span className="text-xs text-[var(--muted)]">View in</span>
          <select
            value={language}
            onChange={(e) => handleChange(e.target.value)}
            disabled={loading}
            className="text-xs rounded-lg border border-[var(--surface-border)] bg-transparent px-2.5 py-1.5 outline-none disabled:opacity-60"
          >
            <option value="">Original</option>
            {SPEECH_LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.label}>
                {opt.label}
              </option>
            ))}
          </select>
          {loading && (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--muted)] border-t-transparent animate-spin" />
          )}
        </div>

        {error && <p className="text-xs text-red-500 dark:text-red-400 text-right mb-3">{error}</p>}

        <ResultsDisplay data={translated || original} emailActions />
      </div>

      {transcript && (
        <div className="surface-card rounded-2xl p-6 md:p-7 shadow-xl shadow-indigo-500/5">
          <button
            type="button"
            onClick={handleToggleTranscript}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
              Full Transcript
            </h2>
            <span className="text-xs text-[var(--muted)] flex items-center gap-2">
              {transcriptLoading && (
                <span className="h-3 w-3 rounded-full border-2 border-[var(--muted)] border-t-transparent animate-spin" />
              )}
              {transcriptOpen ? "Hide" : "Show"}
            </span>
          </button>

          {transcriptOpen && (
            <>
              <p className="mt-3 text-xs text-[var(--muted)]">{language ? `Translated into ${language}. Speaker language labels refer to the original speech. Your original transcript is unchanged.` : "Original words and languages, as captured during the meeting."}</p>
              {(!language || translatedTranscript) && !transcriptLoading && <button type="button" className="mt-3 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-xs font-medium" onClick={() => {
                const url = URL.createObjectURL(new Blob([language ? translatedTranscript || "" : transcript], { type: "text/plain;charset=utf-8" }));
                const link = document.createElement("a"); link.href = url; link.download = `transcript-${language || "original"}.txt`; link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}>Download {language || "original"} transcript</button>}
              {transcriptError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-4">{transcriptError}</p>
              )}
              <p className="text-sm text-[var(--muted)] whitespace-pre-line leading-relaxed mt-4">
                {language ? (translatedTranscript ?? "") : transcript}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
