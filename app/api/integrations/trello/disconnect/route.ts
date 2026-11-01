import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTrelloConnection, trelloUrl } from "@/lib/trello-connection";

export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // Revoke it on Trello's side too, so a disconnected token can't be used again.
  const connection = await getTrelloConnection(user.id);
  if (connection) {
    await fetch(trelloUrl(`/tokens/${connection.token}`, connection.token), { method: "DELETE" }).catch(() => {});
  }
  const { error } = await createServiceClient().from("trello_connections").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not disconnect" }, { status: 503 });
  return NextResponse.redirect(new URL("/settings#integrations", req.url), 303);
}
