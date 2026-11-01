import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCompleteProfile } from "@/lib/displayName";
import { GOOGLE_COMPLETE_PATH, GOOGLE_PENDING_COOKIE, googleNextPath, googlePendingCookieOptions, sealGoogleConnection } from "@/lib/google/pending-connection";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = googleNextPath(searchParams.get("next"));

  // Connecting Google from Settings can come back refused (most often: that
  // Google account already belongs to another MemoValet account). They're
  // still signed in, so the login page is the wrong place to land.
  if (searchParams.get("connect") === "google" && !code) {
    const reason = searchParams.get("error_code") === "identity_already_exists" ? "taken" : "failed";
    return NextResponse.redirect(`${origin}/settings?google=${reason}#integrations`);
  }

  try {
    if (code) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.session) {
        const providerRefreshToken = data.session.provider_refresh_token;

        // Explicit Google connections from Settings or Calendar mark their
        // return trip. This used to check app_metadata.provider —
        // the account's *first* sign-in method — so it saved nothing for anyone
        // who signed up with email or Microsoft, and older code filed Microsoft
        // tokens here that Google then rejected on every dashboard load.
        if (searchParams.get("connect") === "google" && providerRefreshToken) {
          const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (assurance.error || !assurance.data) return NextResponse.redirect(`${origin}/settings?google=failed#integrations`);
          if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
            const response = NextResponse.redirect(`${origin}/mfa?next=${encodeURIComponent(GOOGLE_COMPLETE_PATH)}`);
            response.cookies.set(GOOGLE_PENDING_COOKIE, sealGoogleConnection(data.session.user.id, providerRefreshToken, next), googlePendingCookieOptions(origin));
            response.headers.set("Cache-Control", "private, no-store");
            return response;
          }
          const saved = await supabase.from("user_google_tokens").upsert({
            user_id: data.session.user.id,
            refresh_token: providerRefreshToken,
            updated_at: new Date().toISOString(),
          });
          if (saved.error) return NextResponse.redirect(`${origin}/settings?google=failed#integrations`);
        }

        if (!hasCompleteProfile(data.session.user)) {
          const profileUrl = new URL("/complete-profile", origin);
          profileUrl.searchParams.set("next", next);
          return NextResponse.redirect(profileUrl);
        }

        return NextResponse.redirect(origin + next);
      }
    }
  } catch (err) {
    console.error("Auth callback failed", err);
  }

  return NextResponse.redirect(origin + "/login?error=auth");
}
