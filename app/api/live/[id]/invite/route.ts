import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLiveSessionForHost, markLiveSessionInviteSent } from "@/lib/database";
import { sendAppEmail } from "@/lib/email/send";
import { buildIcsInvite } from "@/lib/ics";

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

    const body = await req.json();
    const toEmail = typeof body.email === "string" ? body.email.trim() : "";

    if (!toEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const session = await getLiveSessionForHost(id, user.id);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const durationMinutes = session.duration_minutes || 60;
    const start = session.scheduled_start ? new Date(session.scheduled_start) : new Date();
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const url = new URL(req.url);
    const joinUrl = url.origin + "/live/" + id;
    const acceptUrl = url.origin + "/live/" + id + "/accept";

    const ics = buildIcsInvite({
      uid: id + "@memovalet.com",
      title: session.title,
      start,
      end,
      description: "Join the live session: " + joinUrl,
      url: joinUrl,
      organizerEmail: user.email,
      attendeeEmail: toEmail,
    });

    const subject = "Invite: " + session.title;
    const bodyText =
      "You're invited to \"" +
      session.title +
      '" on MemoValet.\n\n' +
      "Accept the invite: " +
      acceptUrl +
      "\n\n" +
      "Join here when it starts: " +
      joinUrl +
      "\n\n" +
      "Pick your name and the language you'll speak. Everyone else's speech shows up translated into your own.";

    const emailResult = await sendAppEmail({
      to: toEmail,
      subject,
      text: bodyText,
      userId: user.id,
      ics,
    });
    if (!emailResult.sent) {
      return NextResponse.json(
        { error: "The invite couldn't be emailed. Share this link instead: " + joinUrl, joinUrl },
        { status: 502 }
      );
    }

    await markLiveSessionInviteSent(id, toEmail);

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Couldn't send that invite" }, { status: 500 });
  }
}
