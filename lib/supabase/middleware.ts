import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Two-step verification has to guard the data, not just the pages. The app
    // layout sends a half-signed-in session (password done, authenticator code
    // not yet) to /mfa, but API routes never pass through that layout — so
    // without this, a stolen password alone could still read and change
    // everything by calling them directly. Sessions with no authenticator
    // enrolled never reach aal2 as their next level, so this never touches them,
    // nor anyone signed out (shared links, webhooks).
    if (user && request.nextUrl.pathname.startsWith("/api/")) {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => null);
      const aal = assurance?.data;
      if (!aal || assurance?.error) {
        const unavailable = NextResponse.json(
          { error: "Unable to verify your session. Please try again shortly." },
          { status: 503 }
        );
        supabaseResponse.cookies.getAll().forEach(cookie => unavailable.cookies.set(cookie));
        return unavailable;
      }
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const blocked = NextResponse.json(
          { error: "Two-step verification required. Enter your authenticator code to continue." },
          { status: 401 }
        );
        // Keep any refreshed session cookies, or the user is signed out entirely.
        supabaseResponse.cookies.getAll().forEach((cookie) => blocked.cookies.set(cookie));
        return blocked;
      }

    }
  } catch (err) {
    console.error("Failed to refresh Supabase session", err);
  }

  return supabaseResponse;
}
