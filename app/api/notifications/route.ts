import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMyNotifications } from "@/lib/database";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const notifications = await listMyNotifications(user.id);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error fetching notifications" }, { status: 500 });
  }
}
