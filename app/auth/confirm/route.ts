import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

// The one-time link types an email can carry. Anything else is refused before
// it reaches Supabase.
const EMAIL_OTP_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "invite", "magiclink", "email_change"];

function emailOtpType(value: string | null): EmailOtpType | null {
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType) ? (value as EmailOtpType) : null;
}

// A reset email is good for an hour, so a sign-in from a code within an hour
// of one going out is that email's link being used.
const RECOVERY_WINDOW_MS = 60 * 60 * 1000;

function recentlySentRecovery(user: { recovery_sent_at?: string } | null | undefined): boolean {
  if (!user?.recovery_sent_at) return false;
  const sentAt = new Date(user.recovery_sent_at).getTime();
  return Number.isFinite(sentAt) && Date.now() - sentAt < RECOVERY_WINDOW_MS;
}

function linkFailed(origin: string, type: string | null, status?: number) {
  return NextResponse.redirect(
    origin + (type === "recovery" ? "/login?error=reset-link" : "/login?error=link"),
    status
  );
}

// Email links (confirm sign-up, reset password) land here.
//
// Two shapes arrive:
//   * token_hash — from the customised email templates. Never verified on GET:
//     work email security (Microsoft 365 Safe Links and the like) opens every
//     link in a message before the person sees it, and verifying here would
//     spend the one-time link on the scanner's visit. Instead the person is
//     shown /auth/continue, whose button posts back to POST below — scanners
//     follow links but don't press buttons. It also works on any device.
//   * code — from Supabase's default templates (PKCE). Supabase has already
//     spent the token by the time this arrives, so there's nothing left to
//     protect; it only works in the browser that asked for the email.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"));

  if (tokenHash) {
    const continuePage = new URL("/auth/continue", origin);
    continuePage.searchParams.set("token_hash", tokenHash);
    if (type) continuePage.searchParams.set("type", type);
    if (searchParams.get("next")) continuePage.searchParams.set("next", next);
    return NextResponse.redirect(continuePage);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // A link Supabase sent to the bare site address has lost its ?type= by
        // the time proxy.ts forwards it here, so a reset link is told apart by
        // its reset email having only just gone out.
        const isRecovery = type === "recovery" || (!type && recentlySentRecovery(data.user));
        return NextResponse.redirect(origin + (isRecovery ? "/reset-password" : next));
      }
      console.error("Email link code exchange failed", error.message);
    } catch (err) {
      console.error("Email link code exchange failed", err);
    }
  }

  return linkFailed(origin, type);
}

// The button on /auth/continue. A person pressing it is the only way a
// token_hash link gets spent.
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  if (request.headers.get("origin") !== origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const tokenHash = form?.get("token_hash");
  const rawType = form?.get("type");
  const typeText = typeof rawType === "string" ? rawType : null;
  const type = emailOtpType(typeText);
  const nextValue = form?.get("next");
  const next = safeNextPath(typeof nextValue === "string" ? nextValue : null);

  if (typeof tokenHash === "string" && tokenHash && type) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      // 303 so the browser follows with a GET rather than posting again.
      if (!error) return NextResponse.redirect(origin + (type === "recovery" ? "/reset-password" : next), 303);
      console.error("Email link verification failed", error.message);
    } catch (err) {
      console.error("Email link verification failed", err);
    }
  }

  return linkFailed(origin, typeText, 303);
}
