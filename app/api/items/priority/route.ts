import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OWNED } from "@/lib/owned-items";
import { asPriority, PRIORITY_KINDS, type PriorityKind } from "@/lib/priority";

// Marks one of your own saved items or tasks as high, medium or low — or clears
// it. Pages also list things belonging to other people; every step is scoped to
// the owner, so those can't be marked from here.
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
  const kind = PRIORITY_KINDS.find((candidate) => candidate === body?.kind) as
    | PriorityKind
    | undefined;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!kind || !id) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  // Anything that isn't one of the three levels clears the mark, so "None" and
  // a value the app doesn't know both land in the same harmless place.
  const priority = asPriority(body?.priority);

  const { table, owner } = OWNED[kind];
  const { data, error } = await supabase
    .from(table)
    .update({ priority })
    .eq("id", id)
    .eq(owner, user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`Setting the priority of a ${kind} failed`, error.message);
    return NextResponse.json({ error: "Couldn't save that" }, { status: 500 });
  }
  // No row came back: it isn't there, or it belongs to someone else.
  if (!data) return NextResponse.json({ error: "Only the owner can change this" }, { status: 404 });

  return NextResponse.json({ ok: true, priority });
}
