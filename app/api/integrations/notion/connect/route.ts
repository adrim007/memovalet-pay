import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { issueConnectState } from "@/lib/integration-state";
import { notionConfigured } from "@/lib/notion-connection";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!notionConfigured()) {
    return NextResponse.json({ error: "Notion app setup is not finished yet" }, { status: 503 });
  }

  const state = await issueConnectState("notion", user.id, new URL(req.url).protocol === "https:");
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID || "",
    response_type: "code",
    owner: "user",
    redirect_uri: new URL("/api/integrations/notion/callback", req.url).toString(),
    state,
  }).toString();
  return NextResponse.redirect(url);
}
