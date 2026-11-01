import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReminder, listReminders } from "@/lib/database";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const reminders = await listReminders();
    return NextResponse.json({ reminders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load reminders" }, { status: 500 });
  }
}

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
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const remindAt = typeof body.remindAt === "string" ? body.remindAt : "";

    if (!title || !remindAt) {
      return NextResponse.json({ error: "Title and date are required" }, { status: 400 });
    }

    const reminder = await createReminder({
      userId: user.id,
      title,
      context: typeof body.context === "string" ? body.context.trim() : null,
      remindAt,
    });

    if (!reminder) {
      return NextResponse.json({ error: "Couldn't create that reminder" }, { status: 500 });
    }

    return NextResponse.json({ reminder });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
