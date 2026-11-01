import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteBookmark } from "@/lib/database";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const ok = await deleteBookmark(id);
    if (!ok) return NextResponse.json({ error: "Bookmark not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete bookmark" }, { status: 500 });
  }
}
