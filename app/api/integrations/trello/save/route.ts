import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { consumeConnectState } from "@/lib/integration-state";
import { looksLikeTrelloToken, trelloUrl } from "@/lib/trello-connection";

export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = body?.token;
  if (!(await consumeConnectState("trello", user.id, typeof body?.state === "string" ? body.state : null))) {
    return NextResponse.json({ error: "This connection link expired. Start again from Settings." }, { status: 400 });
  }
  if (!looksLikeTrelloToken(token)) {
    return NextResponse.json({ error: "Trello didn't return a valid connection." }, { status: 400 });
  }

  // Confirm with Trello that the token works before keeping it.
  const me = await fetch(trelloUrl("/members/me", token, { fields: "fullName,username" }));
  if (!me.ok) return NextResponse.json({ error: "Trello didn't accept that connection." }, { status: 400 });
  const member = await me.json();

  const saved = await createServiceClient().from("trello_connections").upsert({
    user_id: user.id,
    token,
    member_name: member.fullName || member.username || "Trello",
    board_name: null,
    list_id: null,
    list_name: null,
    updated_at: new Date().toISOString(),
  });
  if (saved.error) return NextResponse.json({ error: "Could not save the connection." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
