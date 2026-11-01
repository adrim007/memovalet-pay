import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { forgetTrelloConnection, getTrelloConnection, trelloUrl } from "@/lib/trello-connection";

/** Boards and their open lists, so the person can choose where cards go. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const connection = await getTrelloConnection(user.id);
  if (!connection) return NextResponse.json({ error: "Connect Trello first." }, { status: 404 });

  const response = await fetch(
    trelloUrl("/members/me/boards", connection.token, { filter: "open", fields: "name", lists: "open", list_fields: "name" })
  );
  if (response.status === 401) {
    await forgetTrelloConnection(user.id, connection.token);
    return NextResponse.json({ error: "Trello access was removed. Connect again." }, { status: 401 });
  }
  if (!response.ok) return NextResponse.json({ error: "Couldn't load your Trello boards." }, { status: 502 });

  const boards = (await response.json()) as Array<{ id: string; name: string; lists?: Array<{ id: string; name: string }> }>;
  return NextResponse.json({
    boards: boards
      .map((board) => ({ id: board.id, name: board.name, lists: (board.lists || []).map((l) => ({ id: l.id, name: l.name })) }))
      .filter((board) => board.lists.length > 0),
  });
}
