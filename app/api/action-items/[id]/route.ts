import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateActionItemDetails, updateActionItemStatus } from "@/lib/database";

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

    if ("location" in body || "photoUrl" in body || "reminderAt" in body) {
      const ok = await updateActionItemDetails(id, {
        location: body.location,
        photoUrl: body.photoUrl,
        reminderAt: body.reminderAt,
      });
      if (!ok) {
        return NextResponse.json({ error: "Couldn't update that item" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const status = body.status === "done" ? "done" : "todo";

    const ok = await updateActionItemStatus(id, status);

    if (!ok) {
      return NextResponse.json({ error: "Couldn't update that item" }, { status: 500 });
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error updating item" }, { status: 500 });
  }
}
