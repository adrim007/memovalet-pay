import { createServiceClient } from "@/lib/supabase/service";
export function isSlackWebhook(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "hooks.slack.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname.startsWith("/services/")
    );
  } catch {
    return false;
  }
}
export async function getSlackConnection(userId: string) {
  try {
    const { data, error } = await createServiceClient()
      .from("slack_connections")
      .select("webhook_url,team_name,channel_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}
