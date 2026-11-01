import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAppEmail } from "@/lib/email/send";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const item = await supabase
      .from("action_items")
      .select("*, meetings(title)")
      .eq("id", id)
      .single();

    if (item.error || !item.data) {
      return NextResponse.json({ error: "Action item not found" }, { status: 404 });
    }

    const meetings = item.data.meetings as { title?: string } | { title?: string }[] | null;
    const meetingTitle = Array.isArray(meetings) ? meetings[0]?.title : meetings?.title;

    const subject = "Reminder: " + item.data.task;
    const body =
      "Reminder from MemoValet\n\n" +
      "Task: " +
      item.data.task +
      "\n" +
      (item.data.owner ? "Owner: " + item.data.owner + "\n" : "") +
      (item.data.due_date ? "Due: " + item.data.due_date + "\n" : "") +
      "From meeting: " +
      (meetingTitle || "Untitled meeting") +
      "\n";

    const emailResult = await sendAppEmail({ to: user.email, subject, text: body, userId: user.id });
    if (!emailResult.sent) {
      return NextResponse.json(
        { error: "Couldn't send that reminder email right now." },
        { status: 502 }
      );
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Couldn't send that reminder. Is your Google account connected?" },
      { status: 500 }
    );
  }
}
