import { generateAIText, hasConfiguredAIProvider } from "@/lib/ai/provider";
import type { MeetingResult } from "@/lib/types";

// Translating a meeting summary is needed in two places now: the language
// switcher on a saved meeting, and the share pack that emails each person
// their own language. Keeping one prompt means both stay consistent.
export async function translateMeetingResult(
  result: MeetingResult,
  targetLanguage: string
): Promise<MeetingResult | null> {
  if (!hasConfiguredAIProvider()) return null;

  const prompt =
    "Translate the natural-language content of this meeting summary into " +
    targetLanguage +
    ". " +
    "Preserve the original tone and register (formal stays formal, informal stays informal, " +
    "keep slang and colloquialisms natural in the target language rather than textbook-formal). " +
    'Translate: meeting_summary, every string in key_decisions, the "task" field of each ' +
    "action_items entry, and the follow_up_email subject and body. " +
    'Do NOT translate or change: people\'s names (including the "owner" field), dates, ' +
    'the "priority" field (leave it exactly as "high", "medium", "low", or empty), ' +
    "or the metadata fields. Keep the exact same JSON structure and field names as the input. " +
    "Return JSON only, nothing else.\n\n" +
    "Input JSON:\n" +
    JSON.stringify(result);

  try {
    const rawText = await generateAIText({
      prompt,
      maxTokens: 8000,
      json: true,
    });
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    const translated = JSON.parse(jsonText) as MeetingResult;
    if (typeof translated.meeting_summary !== "string" ||
      !Array.isArray(translated.key_decisions) || !translated.key_decisions.every(item => typeof item === "string") ||
      !Array.isArray(translated.action_items) || !translated.action_items.every(item => item && typeof item.task === "string")) return null;
    if (translated.action_items.length !== (result.action_items || []).length) return null;
    if (translated.key_decisions.length !== (result.key_decisions || []).length) return null;
    if (result.follow_up_email && (!translated.follow_up_email ||
      (typeof result.follow_up_email.subject === "string" && typeof translated.follow_up_email.subject !== "string") ||
      (typeof result.follow_up_email.body === "string" && typeof translated.follow_up_email.body !== "string"))) return null;
    translated.metadata = result.metadata;
    translated.action_items = translated.action_items.map((item, index) => ({ ...result.action_items![index], task: item.task }));
    return translated;
  } catch (error) {
    console.error("Meeting translation failed", error);
    return null;
  }
}
