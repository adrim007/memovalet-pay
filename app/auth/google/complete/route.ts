import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCompleteProfile } from "@/lib/displayName";
import { GOOGLE_COMPLETE_PATH, GOOGLE_PENDING_COOKIE, googlePendingCookieOptions, openGoogleConnection } from "@/lib/google/pending-connection";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  function redirect(path: string, clear = true) {
    const response = NextResponse.redirect(origin + path);
    response.headers.set("Cache-Control", "private, no-store");
    if (clear) response.cookies.set(GOOGLE_PENDING_COOKIE, "", { ...googlePendingCookieOptions(origin), maxAge: 0 });
    return response;
  }
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return redirect("/login?error=auth");
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || !assurance.data) return redirect("/settings?google=failed#integrations");
    if (assurance.data.currentLevel !== "aal2") {
      if (assurance.data.nextLevel === "aal2") return redirect(`/mfa?next=${encodeURIComponent(GOOGLE_COMPLETE_PATH)}`, false);
      return redirect("/settings?google=failed#integrations");
    }
    const value = (await cookies()).get(GOOGLE_PENDING_COOKIE)?.value || "";
    const pending = openGoogleConnection(value, user.id);
    if (!pending) return redirect("/settings?google=failed#integrations");
    // Keep the authenticated client's owner and MFA database policies in force.
    const saved = await supabase.from("user_google_tokens").upsert({ user_id: user.id, refresh_token: pending.refreshToken, updated_at: new Date().toISOString() });
    if (saved.error) return redirect("/settings?google=failed#integrations");
    if (!hasCompleteProfile(user)) return redirect(`/complete-profile?next=${encodeURIComponent(pending.next)}`);
    return redirect(pending.next);
  } catch {
    return redirect("/settings?google=failed#integrations");
  }
}
