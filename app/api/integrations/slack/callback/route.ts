import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSlackWebhook } from "@/lib/slack-connection";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const jar = await cookies();
  const expected = jar.get("memovalet_slack_state")?.value;
  jar.set("memovalet_slack_state", "", { path: "/api/integrations/slack", maxAge: 0 });
  const state = url.searchParams.get("state"), code = url.searchParams.get("code");
  if (!user || !state || expected !== `${user.id}:${state}` || !code) return NextResponse.redirect(new URL("/settings?slack=failed#integrations", req.url));
  try {
    const response = await fetch("https://slack.com/api/oauth.v2.access", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.SLACK_CLIENT_ID || "", client_secret: process.env.SLACK_CLIENT_SECRET || "", redirect_uri: new URL("/api/integrations/slack/callback", req.url).toString() }) });
    const data = await response.json();
    if (!response.ok || !data.ok || !isSlackWebhook(data.incoming_webhook?.url)) throw new Error("Slack did not approve this connection");
    const saved = await createServiceClient().from("slack_connections").upsert({ user_id: user.id, webhook_url: data.incoming_webhook.url, team_name: data.team?.name || "Slack", channel_name: data.incoming_webhook.channel || "Selected channel" });
    if (saved.error) throw new Error("Could not save connection");
    return NextResponse.redirect(new URL("/settings?slack=connected#integrations", req.url));
  } catch { return NextResponse.redirect(new URL("/settings?slack=failed#integrations", req.url)); }
}
