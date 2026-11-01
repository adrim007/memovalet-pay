import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTaskAssignmentOwnedBy } from "@/lib/database";
import { sendAppEmail } from "@/lib/email/send";

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

    const assignment = await getTaskAssignmentOwnedBy(id, user.id);
    if (!assignment) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (assignment.status === "done") {
      return NextResponse.json({ error: "That task is already done" }, { status: 400 });
    }

    const url = new URL(req.url);
    const taskUrl = url.origin + "/assigned/" + assignment.id;
    const fromName = user.email || "Someone on MemoValet";

    const subject = "Reminder: " + assignment.title;
    const bodyText =
      fromName +
      ' is checking in on a task: "' +
      assignment.title +
      '"\n\n' +
      (assignment.due_date ? "Due: " + assignment.due_date + "\n" : "") +
      "\nView it and mark it done here: " +
      taskUrl;

    const emailResult = await sendAppEmail({
      to: assignment.recipient_email,
      subject,
      text: bodyText,
      userId: user.id,
    });
    if (!emailResult.sent) {
      return NextResponse.json(
        { error: "The reminder couldn't be emailed. Copy the task link and send it directly." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error sending reminder" }, { status: 500 });
  }
}
