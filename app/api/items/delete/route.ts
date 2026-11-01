import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DELETABLE_KINDS, deleteItem, type DeletableKind } from "@/lib/deletion";

// Deletes one thing you own — a meeting, file, note, project, task, person,
// team, commitment or reminder. Pages also show things that belong to other
// people (a team meeting, a note shared with you); every step here is scoped to
// the owner, so those can't be deleted from here.
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const kind = DELETABLE_KINDS.find((candidate) => candidate === body?.kind) as
    | DeletableKind
    | undefined;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!kind || !id) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  const outcome = await deleteItem(supabase, user.id, kind, id);
  if (outcome === "not_found") {
    return NextResponse.json({ error: "Only the owner can delete this" }, { status: 404 });
  }
  if (outcome === "failed") {
    return NextResponse.json({ error: "Deletion could not be completed. Some attachments or sharing links may already have been removed. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
