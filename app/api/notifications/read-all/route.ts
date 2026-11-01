import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markAllNotificationsRead } from "@/lib/database";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const ok = await markAllNotificationsRead(user.id);
    if (!ok) {
      return NextResponse.json({ error: "Couldn't update notifications" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error updating notifications" }, { status: 500 });
  }
}
