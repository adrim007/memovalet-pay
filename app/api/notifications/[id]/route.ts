import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markNotificationRead } from "@/lib/database";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const ok = await markNotificationRead(id, user.id);
    if (!ok) {
      return NextResponse.json({ error: "Couldn't update that notification" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error updating notification" }, { status: 500 });
  }
}
