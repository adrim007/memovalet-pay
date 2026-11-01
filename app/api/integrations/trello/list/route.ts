import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTrelloConnection, trelloUrl } from "@/lib/trello-connection";

/** Sets the list new cards go into — only a list this person's Trello can reach. */
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const connection = await getTrelloConnection(user.id);
  if (!connection) return NextResponse.json({ error: "Connect Trello first." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const listId = typeof body?.listId === "string" && /^[a-f0-9]{24}$/.test(body.listId) ? body.listId : null;
  if (!listId) return NextResponse.json({ error: "Choose a list." }, { status: 400 });

  // Asking Trello for the list with *their* token proves they can reach it.
  const response = await fetch(trelloUrl(`/lists/${listId}`, connection.token, { fields: "name,closed", board: "true", board_fields: "name" }));
  if (!response.ok) return NextResponse.json({ error: "That list isn't available in your Trello." }, { status: 400 });
  const list = await response.json();
  if (list.closed) return NextResponse.json({ error: "That list is archived." }, { status: 400 });

  const saved = await createServiceClient()
    .from("trello_connections")
    .update({ list_id: listId, list_name: list.name, board_name: list.board?.name || null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (saved.error) return NextResponse.json({ error: "Could not save your choice." }, { status: 503 });
  return NextResponse.json({ ok: true, listName: list.name, boardName: list.board?.name || null });
}
