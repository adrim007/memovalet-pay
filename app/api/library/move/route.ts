import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TABLE_FOR = { meeting: "meetings", file: "documents", note: "notes" } as const;
type Kind = keyof typeof TABLE_FOR;

// Files a meeting, file or note into one of your spaces, or takes it back out
// (folderId: null). The database also refuses a folder that isn't the item
// owner's; checking here first turns that into a clear answer.
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
  const kind = typeof body?.kind === "string" && Object.hasOwn(TABLE_FOR, body.kind) ? (body.kind as Kind) : null;
  const id = typeof body?.id === "string" ? body.id : "";
  const folderId = typeof body?.folderId === "string" && body.folderId ? body.folderId : null;
  if (!kind || !id) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  if (folderId) {
    const { data: folder } = await supabase
      .from("folders")
      .select("id")
      .eq("id", folderId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!folder) return NextResponse.json({ error: "That space doesn't exist" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from(TABLE_FOR[kind])
    .update({ folder_id: folderId })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Library move failed", error.message);
    return NextResponse.json({ error: "Couldn't move that" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Only the owner can file this" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
