import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function getStoredGoogleRefreshToken(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("user_google_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .single();

  if (response.error || !response.data) return null;
  return response.data.refresh_token;
}

// Service-role variant for trusted server-only contexts with no user session
// (e.g. the cron-triggered reminder job). Never expose this path to a request
// that isn't already gated by a server-side secret check.
export async function getStoredGoogleRefreshTokenService(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const response = await service
    .from("user_google_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .single();

  if (response.error || !response.data) return null;
  return response.data.refresh_token;
}

// A stored token Google will never accept again — the person removed
// MemoValet's access, it expired (Google does that after 7 days while an app
// is still in Testing), or it was never a Google token at all (older code filed
// Microsoft sign-in tokens here). Keeping it makes Settings say "Connected"
// while every calendar and Gmail call fails, so it's removed: Settings then
// shows the Connect button. Only removed if it's still the same token, so a
// reconnect racing this failure isn't wiped out.
async function forgetDeadGoogleToken(userId: string, refreshToken: string) {
  try {
    await createServiceClient()
      .from("user_google_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("refresh_token", refreshToken);
  } catch (err) {
    console.error("Couldn't clear an unusable Google connection", err);
  }
}

export async function exchangeForAccessToken(refreshToken: string, userId?: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // invalid_grant is Google's permanent "this token is dead"; outages and
    // other errors come back differently and must not disconnect anyone.
    if (data.error === "invalid_grant" && userId) {
      await forgetDeadGoogleToken(userId, refreshToken);
      throw new Error("Google access has expired or was removed. Reconnect Google in Settings.");
    }
    throw new Error(
      "Failed to refresh Google access token: " + (data.error_description || data.error)
    );
  }

  return data.access_token;
}

export async function getGoogleAccessTokenForUser(userId: string): Promise<string> {
  const refreshToken = await getStoredGoogleRefreshToken(userId);

  if (!refreshToken) {
    throw new Error("No Google account connected. Connect Google in Settings.");
  }

  return exchangeForAccessToken(refreshToken, userId);
}
