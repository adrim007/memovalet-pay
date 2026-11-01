import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteItem } from "@/lib/deletion";
import { updateDocument } from "@/lib/database";

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
    const update: {
      title?: string;
      notes?: string | null;
      folderId?: string | null;
      color?: string | null;
    } = {};
    if (typeof body.title === "string") {
      const trimmed = body.title.trim();
      if (!trimmed) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
      update.title = trimmed;
    }
    if ("notes" in body) update.notes = typeof body.notes === "string" ? body.notes : null;
    if ("folderId" in body)
      update.folderId = typeof body.folderId === "string" ? body.folderId : null;
    if ("color" in body) {
      const allowed = ["yellow", "blue", "green", "orange"];
      update.color = allowed.includes(body.color) ? body.color : null;
    }

    const ok = await updateDocument(id, update);

    if (!ok) {
      return NextResponse.json({ error: "Couldn't update that document" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error updating document" }, { status: 500 });
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

    const outcome = await deleteItem(supabase, user.id, "file", id);
    if (outcome === "not_found") {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (outcome === "failed") {
      return NextResponse.json({ error: "Couldn't delete that document" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error deleting document" }, { status: 500 });
  }
}
