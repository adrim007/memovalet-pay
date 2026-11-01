import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getMeeting } from "@/lib/database";
import { toMeetingResult, type MeetingResult } from "@/lib/types";
import { buildMeetingPdf } from "@/lib/pdf/meetingPdf";
import { translateMeetingResult } from "@/lib/translateMeeting";
import { sendAppEmail } from "@/lib/email/send";
import { getTranslatedTranscript, validTranslationLanguage } from "@/lib/transcript-translation";

export const maxDuration = 300;

interface Recipient {
  email: string;
  language?: string;
}

interface SendOutcome {
  email: string;
  language: string;
  sent: boolean;
  translated: boolean;
  error?: string;
}

function safeFilename(title: string) {
  const cleaned = title.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || "meeting") + ".pdf";
}

// POST /api/meetings/[id]/share-pack
// Sends everyone who was in the meeting the same pack — summary PDF,
// recording link, transcript — each in their own language, in one go.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const rawRecipients: Recipient[] = Array.isArray(body.recipients) ? body.recipients : [];
    const includePdf = body.includePdf !== false;
    const includeRecording = body.includeRecording !== false;
    const includeTranscript = body.includeTranscript === true;
    const transcriptMode = body.transcriptMode || "original";
    if (!["original", "translated", "both"].includes(transcriptMode)) return NextResponse.json({ error: "Choose a transcript format" }, { status: 400 });
    if (rawRecipients.length > 10) return NextResponse.json({ error: "Send to up to 10 people at a time" }, { status: 400 });

    const recipients = rawRecipients
      .map((r) => ({ email: typeof r?.email === "string" ? r.email.trim() : "", language: typeof r?.language === "string" ? r.language.trim() : "" }));
    if (recipients.some(r => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(r.email) || (r.language && !validTranslationLanguage(r.language)))) {
      return NextResponse.json({ error: "Check each email address and language" }, { status: 400 });
    }

    if (!recipients.length) {
      return NextResponse.json({ error: "Add at least one person to send to" }, { status: 400 });
    }

    const meeting = await getMeeting(id);
    if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

    // One share link for the whole pack; reused if the meeting already has one.
    const includeBrowserLink = body.includeBrowserLink === true;
    let token: string | null = includeBrowserLink ? meeting.share_token ?? null : null;
    if (includeBrowserLink && !token) {
      token = randomUUID().replace(/-/g, "");
      const update = await supabase.from("meetings").update({ share_token: token }).eq("id", id);
      if (update.error) {
        console.error(update.error);
        token = null;
      }
    }
    const origin = new URL(req.url).origin;
    const shareUrl = token ? `${origin}/share/${token}` : null;

    const original = toMeetingResult(meeting);

    // Translate once per language, not once per person.
    const byLanguage = new Map<string, MeetingResult | null>();
    for (const recipient of recipients) {
      const language = recipient.language;
      if (!language || byLanguage.has(language)) continue;
      byLanguage.set(language, await translateMeetingResult(original, language));
    }

    const results: SendOutcome[] = [];

    for (const recipient of recipients) {
      try {
      const language = recipient.language;
      const translated = language ? byLanguage.get(language) ?? null : null;
      if (language && !translated) throw new Error("The summary translation failed. Nothing was sent to this person; try again.");
      const result = translated || original;
      const usedTranslation = !!translated;

      const attachments: Array<{ filename: string; content: Buffer }> = [];
      if (includePdf) {
        try {
          // Standard PDF fonts do not cover every script. A UTF-8 attachment
          // preserves the translation instead of silently producing missing glyphs.
          if (/[^\u0000-\u00ff]/.test(meeting.title + JSON.stringify(result))) {
            const summaryText = [meeting.title, result.meeting_summary || "", ...(result.key_decisions || []), ...(result.action_items || []).map(item => `${item.task}${item.owner ? ` (${item.owner})` : ""}`)].join("\n\n");
            attachments.push({ filename: `summary-${language || "original"}.txt`, content: Buffer.from(summaryText, "utf8") });
          } else {
          const pdf = await buildMeetingPdf(meeting.title, result);
          attachments.push({ filename: safeFilename(meeting.title), content: pdf });
          }
        } catch { throw new Error("The PDF could not be prepared. Nothing was sent to this person."); }
      }
      if (includeTranscript && meeting.transcript) {
        if (transcriptMode !== "translated" || !language) attachments.push({ filename: "transcript-original.txt", content: Buffer.from(meeting.transcript, "utf-8") });
        if (transcriptMode !== "original" && language) {
          const text = await getTranslatedTranscript(meeting.id, meeting.transcript, language);
          attachments.push({ filename: `transcript-${language.toLowerCase()}.txt`, content: Buffer.from(text, "utf-8") });
        }
      }

      const lines = [
        `Here's the pack from "${meeting.title}".`,
        "",
        result.meeting_summary || "",
      ];
      if (result.key_decisions?.length) {
        lines.push("", "Decisions:", ...result.key_decisions.map((d) => `- ${d}`));
      }
      if (result.action_items?.length) {
        lines.push(
          "",
          "Tasks:",
          ...result.action_items.map((a) => `- ${a.task}${a.owner ? ` (${a.owner})` : ""}${a.due_date ? ` — due ${a.due_date}` : ""}`)
        );
      }
      if (includePdf) lines.push("", "The summary is attached as a PDF or a UTF-8 text file so all characters remain readable.");
      if (includeTranscript && meeting.transcript) {
        lines.push(`Transcript attachments: ${attachments.filter(a => a.filename.endsWith(".txt")).map(a => a.filename).join(", ")}.`);
      }
      if (includeRecording && meeting.video_url) {
        lines.push("", `Recording (sign in required): ${origin}/history/${meeting.id}`);
      }
      if (shareUrl) lines.push("", `Open it in your browser: ${shareUrl}`);
      lines.push("", "Sent with MemoValet.");

      const emailResult = await sendAppEmail({
        to: recipient.email,
        subject: `Meeting pack: ${meeting.title}`,
        text: lines.join("\n"),
        userId: user.id,
        attachments: attachments.length ? attachments : undefined,
      });

      results.push({
        email: recipient.email,
        language: language || "original",
        sent: emailResult.sent,
        translated: usedTranslation,
        error: emailResult.error,
      });
      } catch (error) {
        results.push({ email: recipient.email, language: recipient.language || "original", sent: false, translated: false, error: error instanceof Error ? error.message : "Nothing was sent to this person. Try again." });
      }
    }

    return NextResponse.json({
      results,
      shareUrl,
      sentCount: results.filter((r) => r.sent).length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error sending the meeting pack" }, { status: 500 });
  }
}
