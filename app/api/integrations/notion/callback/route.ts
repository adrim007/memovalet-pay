import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { consumeConnectState } from "@/lib/integration-state";
import { pickParentPage } from "@/lib/notion-connection";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (result: string) => NextResponse.redirect(new URL(`/settings?notion=${result}#integrations`, req.url));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const code = url.searchParams.get("code");
  if (!user || !code || !(await consumeConnectState("notion", user.id, url.searchParams.get("state")))) {
    return back("failed");
  }

  try {
    const credentials = Buffer.from(
      `${process.env.NOTION_CLIENT_ID || ""}:${process.env.NOTION_CLIENT_SECRET || ""}`
    ).toString("base64");
    const response = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: { Authorization: "Basic " + credentials, "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: new URL("/api/integrations/notion/callback", req.url).toString(),
      }),
    });
    const data = await response.json();
    if (!response.ok || typeof data.access_token !== "string") throw new Error("Notion did not approve this connection");

    // Notes need a page to live in; people choose which pages to share while
    // connecting. If they shared none, still save the connection and say so.
    const page = await pickParentPage(data.access_token);
    const saved = await createServiceClient().from("notion_connections").upsert({
      user_id: user.id,
      access_token: data.access_token,
      workspace_id: data.workspace_id || null,
      workspace_name: data.workspace_name || "Notion",
      parent_page_id: page?.id || null,
      parent_page_title: page?.title || null,
      updated_at: new Date().toISOString(),
    });
    if (saved.error) throw new Error("Could not save connection");
    return back(page ? "connected" : "nopage");
  } catch (err) {
    console.error("Notion connection failed", err instanceof Error ? err.message : err);
    return back("failed");
  }
}
