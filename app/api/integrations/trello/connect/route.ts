import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { issueConnectState } from "@/lib/integration-state";
import { trelloConfigured } from "@/lib/trello-connection";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!trelloConfigured()) {
    return NextResponse.json({ error: "Trello app setup is not finished yet" }, { status: 503 });
  }

  const state = await issueConnectState("trello", user.id, new URL(req.url).protocol === "https:");
  // Trello returns the token in the fragment of return_url, which only the
  // browser sees; the return page hands it back with this state attached.
  const returnUrl = new URL("/settings/trello", req.url);
  returnUrl.searchParams.set("state", state);

  const url = new URL("https://trello.com/1/authorize");
  url.search = new URLSearchParams({
    key: process.env.TRELLO_API_KEY || "",
    name: "MemoValet",
    scope: "read,write",
    expiration: "never",
    response_type: "token",
    callback_method: "fragment",
    return_url: returnUrl.toString(),
  }).toString();
  return NextResponse.redirect(url);
}
