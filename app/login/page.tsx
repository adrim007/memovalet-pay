"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  FolderOpen,
  NotePencil,
  ShieldCheck,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import PasswordStrength from "@/components/PasswordStrength";
import { MIN_PASSWORD, passwordStrength } from "@/lib/password-strength";
import { BREACHED_HINT, checkPasswordBreachedHere } from "@/lib/breached-password";

type Mode = "login" | "signup" | "forgot";

const LOGIN_FEATURES = [
  { Icon: NotePencil, text: "Capture the details while they’re fresh" },
  { Icon: CheckCircle, text: "Keep every next step easy to find" },
  { Icon: FolderOpen, text: "Bring projects and documents into one view" },
];

// Messages for links that bounced back here from /auth/confirm or /auth/callback.
const LINK_ERRORS: Record<string, string> = {
  link: "That link has expired or was already used. If you just confirmed your email, log in with your password below.",
  auth: "That link has expired or was opened in a different browser. If you just confirmed your email, log in with your password below.",
  "reset-link": "That reset link has expired or was already used. Ask for a new one below.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/dashboard";
  const linkError = LINK_ERRORS[searchParams.get("error") || ""] || "";

  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [outlookLoading, setOutlookLoading] = useState(false);
  const [error, setError] = useState(linkError);
  const [notice, setNotice] = useState("");
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
    setUnconfirmedEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  // Email links now go to /auth/confirm (see that route for why), which works
  // from any device. The `next` survives the round trip in the query string.
  const confirmUrl = () =>
    window.location.origin + "/auth/confirm?next=" + encodeURIComponent(next);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setUnconfirmedEmail("");

    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      if (loginError.code === "email_not_confirmed") {
        setUnconfirmedEmail(email.trim());
        setError("Please confirm your email using the link we sent when you signed up.");
      } else if (loginError.code === "invalid_credentials") {
        // Accounts made before passwords existed have none yet; the reset flow
        // is how they set one, so point there rather than just saying "wrong".
        setError(
          "Email or password is incorrect. If you used to sign in with an email link, use “Forgot password” to set a password."
        );
      } else if (loginError.status === 429) {
        setError("Too many attempts. Wait a few minutes, then try again.");
      } else {
        setError("We couldn't log you in. Please try again.");
      }
      setBusy(false);
      return;
    }

    // The app layout takes it from here: authenticator code if they have one,
    // profile if it's unfinished, the 2-step question if it's never been asked.
    router.replace(next);
    router.refresh();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
      return;
    }
    // The ones that are guessed in seconds, whatever the length rule says.
    const strength = passwordStrength(password, { email });
    if (strength.unsafe) {
      setError(strength.hint);
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    // Already stolen from somewhere else, however strong it looks. The
    // password itself never leaves this device (see lib/breached-password).
    if ((await checkPasswordBreachedHere(password)).breached) {
      setError(BREACHED_HINT);
      setBusy(false);
      return;
    }

    const supabase = createClient();
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: confirmUrl() },
    });

    if (signupError) {
      if (signupError.code === "weak_password") {
        setError("That password is too easy to guess. Try a longer one with a mix of words and numbers.");
      } else if (signupError.status === 429) {
        setError("Too many registration attempts. Wait a few minutes, then try again.");
      } else {
        setError("We couldn't create your account. Please try again.");
      }
      setBusy(false);
      return;
    }

    // Email confirmation switched off in Supabase: they're signed in already.
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }

    // Deliberately the same message whether or not the address already has an
    // account, so the form can't be used to find out who's signed up.
    setNotice(
      `Check ${email.trim()} for a link to confirm your account. The email may take a minute to arrive. Please check your junk folder too.`
    );
    setPassword("");
    setConfirmPassword("");
    setBusy(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/auth/confirm?type=recovery",
    });

    if (resetError && resetError.status === 429) {
      setError("Too many requests. Wait a few minutes, then try again.");
    } else {
      // Same message either way, for the same reason as sign-up.
      setNotice(
        `If ${email.trim()} has an account, we've sent a link to set a new password. Check your junk folder too.`
      );
    }
    setBusy(false);
  };

  const resendConfirmation = async () => {
    if (!unconfirmedEmail || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: unconfirmedEmail,
      options: { emailRedirectTo: confirmUrl() },
    });
    setError("");
    setNotice(
      resendError
        ? "We couldn't resend it just now. Wait a minute and try again."
        : `We've sent a new confirmation link to ${unconfirmedEmail}.`
    );
    setUnconfirmedEmail("");
    setBusy(false);
  };

  // Google sign-in lives in GoogleSignInButton: it takes the ID token on this
  // domain rather than redirecting through Supabase, so Google's account
  // chooser names memovalet.com instead of the raw database URL. Sign-in stays
  // scope-minimal either way — Calendar and Gmail remain a separate, explicit
  // connection from Settings, so only that action carries a consent warning.
  const handleOutlookSignIn = async () => {
    setOutlookLoading(true);
    setError("");

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: window.location.origin + "/auth/callback?next=" + encodeURIComponent(next),
        // Keep sign-in limited to identity. Calendar access should be a
        // separate, deliberate connection from Settings rather than a
        // permission wall before the user has even reached MemoValet.
        scopes: "email",
      },
    });

    if (signInError) {
      setError("Couldn't start signing you in. Try again.");
      setOutlookLoading(false);
    }
  };

  const inputClasses =
    "h-12 w-full rounded-xl border border-white/15 bg-white/[0.055] px-4 text-[15px] text-white placeholder:text-white/35 outline-none transition hover:border-white/25 focus:border-violet-300 focus:bg-white/[0.075] focus:ring-4 focus:ring-violet-400/15";
  const primaryButton =
    "h-12 w-full brand-gradient-bg rounded-xl text-[15px] font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60";

  const heading = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back";
  const subheading = mode === "signup"
    ? "Start with a free workspace. Upgrade whenever you are ready."
    : mode === "forgot"
      ? "We’ll send you a secure link to choose a new password."
      : "Log in to pick up where you left off.";

  return (
    <main className="mk-dark login-bg relative flex min-h-[100svh] items-center justify-center overflow-clip px-4 py-20 sm:px-6 lg:px-10 lg:py-6">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />
      <div className="login-blob login-blob-4" />
      <div className="login-blob login-blob-5" />
      <div className="login-blob login-blob-6" />

      {/* The wordmark links home, but that isn't obvious to someone who
          landed here and just wants to read about the product first. */}
      <Link
        href="/"
        className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#100d24]/55 px-3.5 py-2 font-sans text-sm font-semibold text-white/85 shadow-lg shadow-black/10 backdrop-blur-xl transition hover:border-violet-300/40 hover:bg-white/10 hover:text-white sm:left-6 sm:top-6 lg:left-8 lg:top-8"
      >
        <ArrowLeft size={16} weight="bold" aria-hidden="true" />
        Back to home
      </Link>

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/15 bg-[#0d0a1f]/72 font-sans shadow-[0_40px_110px_rgba(4,2,20,0.55)] backdrop-blur-2xl lg:min-h-[650px] lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 p-10 lg:flex xl:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(129,92,246,0.24),transparent_35%),radial-gradient(circle_at_85%_82%,rgba(217,70,239,0.16),transparent_38%)]" />
          <div className="relative">
            <Logo size="lg" href="/" pop wordmarkClassName="text-white" />
          </div>

          <div className="relative max-w-md py-10">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
              <ShieldCheck size={16} weight="fill" aria-hidden="true" />
              Your private workspace
            </p>
            <h1 className="max-w-sm text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white xl:text-[2.9rem]">
              Pick up where you left off.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/65">
              Keep notes, files, tasks and conversations together, then share only what you choose.
            </p>

            <div className="mt-8 grid gap-3 text-sm text-white/78">
              {LOGIN_FEATURES.map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-400/15 text-violet-200">
                    <Icon size={19} weight="duotone" aria-hidden="true" />
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-xs leading-5 text-white/45">
            One workspace for personal priorities and shared responsibilities.
          </p>
        </section>

        <section className="relative flex items-center bg-[#120e28]/64 p-4 sm:p-7 lg:p-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-7 flex justify-center lg:hidden">
              <Logo size="lg" href="/" pop wordmarkClassName="text-white" />
            </div>

            <div className="rounded-[1.65rem] border border-white/14 bg-[#17122f]/88 p-5 text-center shadow-[0_24px_70px_rgba(3,1,15,0.38)] sm:p-7 [--muted:#cfc9e4]">
              <div className="mb-5 text-left">
                <h2 className="text-2xl font-semibold tracking-[-0.025em] text-white">{heading}</h2>
                <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{subheading}</p>
              </div>

        {mode !== "forgot" ? (
          <div
            role="tablist"
            aria-label="Log in or sign up"
            className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/15 p-1"
          >
            {(["login", "signup"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab}
                onClick={() => switchMode(tab)}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  mode === tab ? "brand-gradient-bg text-white shadow" : "text-[var(--muted)] hover:bg-white/5 hover:text-white"
                }`}
              >
                {tab === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-5 rounded-xl border border-violet-300/15 bg-violet-400/[0.07] px-4 py-3 text-left text-sm leading-6 text-[var(--muted)]">
            This also works if you previously signed in using an email link.
          </div>
        )}

        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-300/20 bg-red-400/10 px-3.5 py-3 text-left text-sm leading-5 text-red-200">
            {error}
            {unconfirmedEmail && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={resendConfirmation}
                  disabled={busy}
                  className="font-semibold text-white underline underline-offset-2"
                >
                  Send the link again
                </button>
              </>
            )}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3.5 py-3 text-left text-sm leading-5 text-emerald-100">
            {notice}
          </p>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <label className="block text-sm font-medium text-white/85">
              Email
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
                className={`${inputClasses} mt-1.5`}
              />
            </label>
            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="login-password" className="text-sm font-medium text-white/85">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs font-medium text-violet-200 transition hover:text-white"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={`${inputClasses} mt-1.5`}
              />
            </div>
            <button type="submit" disabled={busy} className={primaryButton}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignup} className="space-y-3 text-left">
            <label htmlFor="signup-email" className="block text-sm font-medium text-white/85">Email</label>
            <input
              id="signup-email"
              type="email"
              aria-label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
              className={inputClasses}
            />
            <label htmlFor="signup-password" className="block text-sm font-medium text-white/85">Choose a password</label>
            <input
              id="signup-password"
              type="password"
              aria-label="Choose a password"
              placeholder={`Choose a password (${MIN_PASSWORD}+ characters)`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              aria-describedby="signup-password-strength"
              required
              className={inputClasses}
            />
            <PasswordStrength password={password} email={email} id="signup-password-strength" />
            <label htmlFor="signup-confirm" className="block text-sm font-medium text-white/85">Confirm your password</label>
            <input
              id="signup-confirm"
              type="password"
              aria-label="Type the password again"
              placeholder="Type it again"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              className={inputClasses}
            />
            <button type="submit" disabled={busy} className={`${primaryButton} !mt-3`}>
              {busy ? "Creating your account…" : "Create account"}
            </button>
            <p className="pt-1 text-center text-xs leading-5 text-[var(--muted)]">
              After confirming your email, you can secure your account with Google Authenticator or another authenticator app.
            </p>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgot} className="space-y-2 text-left">
            <input
              type="email"
              aria-label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
              className={inputClasses}
            />
            <button type="submit" disabled={busy} className={primaryButton}>
              {busy ? "Sending…" : "Email me a reset link"}
            </button>
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="block w-full pt-2 text-center text-sm font-medium text-[var(--muted)] hover:text-white"
            >
              ← Back to log in
            </button>
          </form>
        )}

        {mode !== "forgot" && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-white/15" />
              <span className="text-xs text-[var(--muted)]">or</span>
              <div className="flex-1 h-px bg-white/15" />
            </div>

            <GoogleSignInButton next={next} onError={setError} />

            <button
              type="button"
              onClick={handleOutlookSignIn}
              disabled={outlookLoading}
              className="w-full text-base font-medium py-2.5 rounded-xl border border-white/20 bg-white/[0.04] mt-2.5 transition hover:border-indigo-400/40 hover:bg-indigo-400/10 disabled:opacity-60"
            >
              {outlookLoading ? "Redirecting…" : "Continue with Microsoft"}
            </button>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3 text-left">
              <ShieldCheck size={18} weight="duotone" className="mt-0.5 shrink-0 text-violet-200" aria-hidden="true" />
              <p className="text-xs leading-5 text-[var(--muted)]">
                After you sign in, you can add an extra verification step using Google Authenticator, Microsoft Authenticator or Authy.
              </p>
            </div>
          </>
        )}
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-white/45">
              Any email works. Calendar and Gmail tools can be connected later in Settings.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
