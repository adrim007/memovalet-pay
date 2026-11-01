import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteItem } from "@/lib/deletion";
import { updateNote } from "@/lib/database";

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
    const bodyText = typeof body.body === "string" ? body.body.trim() : "";
    if (!bodyText) {
      return NextResponse.json({ error: "Note can't be empty" }, { status: 400 });
    }

    const note = await updateNote(id, {
      title: typeof body.title === "string" ? body.title.trim() : null,
      body: bodyText,
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const outcome = await deleteItem(supabase, user.id, "note", id);
    if (outcome === "not_found") {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    if (outcome === "failed") {
      return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
