import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateReminderStatus } from "@/lib/database";

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

    const body = await req.json();
    const status = body.status === "done" || body.status === "dismissed" ? body.status : null;

    if (!status) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const ok = await updateReminderStatus(id, status);

    if (!ok) {
      return NextResponse.json({ error: "Couldn't update that reminder" }, { status: 500 });
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error updating reminder" }, { status: 500 });
  }
}
