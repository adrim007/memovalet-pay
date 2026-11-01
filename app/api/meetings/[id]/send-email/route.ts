import { NextResponse } from "next/server";
import { getMeeting } from "@/lib/database";
import { buildMeetingPdf } from "@/lib/pdf/meetingPdf";
import { sendAppEmail } from "@/lib/email/send";
import { toMeetingResult } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

function safeFilename(title: string) {
  const cleaned = title.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || "meeting") + ".pdf";
}

// Emails one meeting's summary as a PDF.
//
// This used to go out through the sender's own Gmail, which meant it worked
// only for someone who had signed in with Google *and* connected Gmail in
// Settings — for everyone else it threw "No Google account connected" and the
// page said "Couldn't send that. Try again.", which was never going to help.
// It now goes through the same sender as every other app email, falling back
// to Gmail only if that isn't configured, and says plainly when it fails.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
      return NextResponse.json({ error: "Check that email address" }, { status: 400 });
    }

    const meeting = await getMeeting(id);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const result = toMeetingResult(meeting);
    const attachments: Array<{ filename: string; content: Buffer }> = [];
    try {
      attachments.push({ filename: safeFilename(meeting.title), content: await buildMeetingPdf(meeting.title, result) });
    } catch (error) {
      // Better to send the summary as text than to fail the whole send.
      console.error("Meeting PDF could not be built for emailing", error);
    }

    const lines = [`Here's the summary of "${meeting.title}".`, "", result.meeting_summary || ""];
    if (result.key_decisions?.length) {
      lines.push("", "Decisions:", ...result.key_decisions.map((decision) => `- ${decision}`));
    }
    if (result.action_items?.length) {
      lines.push(
        "",
        "Tasks:",
        ...result.action_items.map(
          (item) => `- ${item.task}${item.owner ? ` (${item.owner})` : ""}${item.due_date ? ` — due ${item.due_date}` : ""}`
        )
      );
    }
    if (attachments.length) lines.push("", "The full summary is attached as a PDF.");
    lines.push("", "Sent with MemoValet.");

    const sendResult = await sendAppEmail({
      to: email,
      subject: `Meeting summary: ${meeting.title}`,
      text: lines.join("\n"),
      userId: user.id,
      attachments: attachments.length ? attachments : undefined,
    });

    if (!sendResult.sent) {
      return NextResponse.json(
        { error: sendResult.error || "The email could not be sent. Nothing was delivered." },
        { status: 502 }
      );
    }

    return NextResponse.json({ sent: true, withPdf: attachments.length > 0 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
