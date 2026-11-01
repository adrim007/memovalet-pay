import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteFolder, updateFolder } from "@/lib/database";

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
    const update: { name?: string; parentId?: string | null } = {};
    if (typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
      update.name = trimmed;
    }
    if ("parentId" in body)
      update.parentId = typeof body.parentId === "string" ? body.parentId : null;

    const ok = await updateFolder(id, update);

    if (!ok) {
      return NextResponse.json({ error: "Couldn't update that folder" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error updating folder" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const ok = await deleteFolder(id);

    if (!ok) {
      return NextResponse.json({ error: "Couldn't delete that folder" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error deleting folder" }, { status: 500 });
  }
}
