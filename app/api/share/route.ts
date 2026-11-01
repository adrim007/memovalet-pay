import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAppEmail } from "@/lib/email/send";

// Emails someone a link to a piece of work (a project or a task). The link
// must point back at this app — this is not a general "email any URL" relay.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const path = typeof body.path === "string" ? body.path.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!email || !path.startsWith("/") || path.startsWith("//") || !title) {
      return NextResponse.json({ error: "A valid email and something to share are required" }, { status: 400 });
    }

    const url = new URL(req.url).origin + path;
    const fromName = user.email || "Someone on MemoValet";

    const result = await sendAppEmail({
      to: email,
      subject: fromName + ' shared "' + title + '" with you on MemoValet',
      text:
        fromName +
        ' shared "' +
        title +
        '" with you.\n\nOpen it here: ' +
        url +
        "\n\nIf you weren't expecting this, you can ignore it.",
      userId: user.id,
    });

    return NextResponse.json({ url, emailed: result.sent });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error sharing that" }, { status: 500 });
  }
}
