import { MeetingType } from "./types";

const typeInstructions: Record<MeetingType, string> = {
  general:
    "This is a general meeting. Write a balanced summary covering what was discussed, decided, and what happens next. For follow_up_email, draft a short recap email a participant could send as-is, summarizing what was covered and what happens next.",
  sales:
    "This is a sales or discovery call. In meeting_summary, focus on the prospect's pain points, budget/timeline signals, and objections raised. In key_decisions, capture anything the prospect committed to (next call, trial, approval steps). Action items should read like CRM follow-up tasks with clear owners on both sides. For follow_up_email, draft it as a proposal-style recap to the prospect: restate their stated problem in their own words, summarize what was discussed as the fit, and end with a specific, low-friction next step (a date, a trial, a next call) rather than a generic \"let me know if you have questions.\"",
  one_on_one:
    "This is a 1:1 between a manager and a report. Keep meeting_summary focused on how the person is doing, blockers, and career/growth topics — not just task status. Action items should be specific commitments either person made, with an owner. For follow_up_email, draft it as a short private recap note to the report themselves (not a formal external email) confirming what was agreed and any commitments made on either side.",
  standup:
    "This is a team standup. Keep meeting_summary terse — a few lines on overall progress and any blockers raised. key_decisions should only include things that actually changed (scope, priority, deadlines) — leave it empty if nothing changed. Action items should be concrete unblockers, not routine status updates, and unless a longer deadline is clearly stated, treat them as due the next working day. For follow_up_email, keep it to a few lines at most — just blockers that need someone else's attention today, or leave the body empty if there's nothing that needs raising outside the team.",
  planning:
    "This is a planning or roadmap meeting. meeting_summary should capture the options considered and the reasoning, not just the outcome. key_decisions should be the actual scope/priority calls made. Action items should include research or scoping tasks, not just execution tasks. For follow_up_email, draft it as a decision recap to stakeholders: what was decided, why, and what's now out of scope or deferred, so nobody has to reconstruct the reasoning later.",
};

export function buildTranscriptPrompt(transcript: string, meetingType: MeetingType): string {
  const typeGuidance = typeInstructions[meetingType] || typeInstructions.general;

  return (
    "You are an assistant that processes meeting transcripts. " +
    typeGuidance +
    " Return JSON only with meeting_summary, key_decisions, action_items, follow_up_email, metadata. " +
    "action_items entries should have task, owner, due_date, priority fields. " +
    "due_date must be an ISO 8601 date (YYYY-MM-DD) if a specific or clearly inferable date was mentioned " +
    '(resolve relative dates like "next Friday" against today\'s date, ' +
    new Date().toISOString().slice(0, 10) +
    ") — otherwise leave due_date empty. " +
    "metadata should have duration and sentiment fields, where sentiment is exactly one of: positive, neutral, mixed, negative. " +
    "Transcript: " +
    transcript
  );
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  general: "General Meeting",
  sales: "Sales Call",
  one_on_one: "One on One",
  standup: "Team Standup",
  planning: "Planning Session",
};
