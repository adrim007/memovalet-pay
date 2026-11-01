import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) return NextResponse.json({ error: "Slack app setup is not finished yet" }, { status: 503 });
  const state = randomBytes(32).toString("hex");
  (await cookies()).set("memovalet_slack_state", `${user.id}:${state}`, { httpOnly: true, sameSite: "lax", secure: new URL(req.url).protocol === "https:", path: "/api/integrations/slack", maxAge: 600 });
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.search = new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID, scope: "incoming-webhook", state, redirect_uri: new URL("/api/integrations/slack/callback", req.url).toString() }).toString();
  return NextResponse.redirect(url);
}
