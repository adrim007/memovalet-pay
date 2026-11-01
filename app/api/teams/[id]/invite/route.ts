import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTeamInvite } from "@/lib/database";
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

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";

    const invite = await createTeamInvite(id, user.id, email || undefined);

    if (!invite) {
      return NextResponse.json(
        { error: "Couldn't create an invite. Are you the team owner?" },
        { status: 403 }
      );
    }

    const origin = new URL(req.url).origin;
    const url = origin + "/teams/join/" + invite.token;

    let emailed = false;
    if (email) {
      try {
        const emailResult = await sendAppEmail({
          to: email,
          subject: "You've been invited to a team on MemoValet",
          text: "Join the team here: " + url + "\n\nIf you weren't expecting this, you can ignore it.",
          userId: user.id,
        });
        emailed = emailResult.sent;
      } catch (err) {
        console.error("Invite email failed, falling back to link-only", err);
      }
    }

    return NextResponse.json({ url, emailed });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error creating invite" }, { status: 500 });
  }
}
