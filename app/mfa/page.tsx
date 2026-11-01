"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKey, ShieldCheck } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import SignOutButton from "@/components/SignOutButton";

function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/dashboard";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (listError || !data) {
        setError("Couldn't load your security settings. Try signing in again.");
        setLoading(false);
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (!verified) {
        // No factor to challenge, nothing blocking them, send them onward.
        router.replace(next);
        return;
      }
      setFactorId(verified.id);
      setLoading(false);
    });
  }, [router, next]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.trim().length !== 6) return;

    setVerifying(true);
    setError("");

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError || !challenge) {
      setError("Couldn't start verification. Try again.");
      setVerifying(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    if (verifyError) {
      setError("That code didn't work. Check your authenticator app and try again.");
      setVerifying(false);
      return;
    }

    router.push(next);
  };

  return (
    <main className="mk-dark login-bg relative flex min-h-[100svh] items-center justify-center overflow-clip px-5 py-12 font-sans">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-4" />

      <section className="relative w-full max-w-md rounded-[1.75rem] border border-white/15 bg-[#151129]/90 p-6 text-center shadow-[0_32px_90px_rgba(3,1,15,0.55)] backdrop-blur-2xl sm:p-8 [--muted:#d2cce4]">
        <div className="flex justify-center mb-5">
          <Logo size="lg" href="/" pop wordmarkClassName="text-white" />
        </div>
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
          <LockKey size={25} weight="duotone" aria-hidden="true" />
        </div>
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">
          <ShieldCheck size={15} weight="fill" aria-hidden="true" />
          Extra security check
        </p>
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-white">Enter your 6-digit code</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-[var(--muted)]">
          Open Google Authenticator or the authenticator app you connected to MemoValet.
        </p>

        {loading ? (
          <p className="text-sm text-[var(--muted)] py-2.5">Checking your account…</p>
        ) : (
          <form onSubmit={handleVerify} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              autoFocus
              aria-label="Six-digit authenticator code"
              className="h-14 w-full rounded-xl border border-white/15 bg-white/[0.055] px-3.5 text-center text-lg tracking-[0.5em] text-white outline-none transition placeholder:text-white/25 hover:border-white/25 focus:border-violet-300 focus:ring-4 focus:ring-violet-400/15"
            />
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="h-12 w-full rounded-xl brand-gradient-bg font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {verifying ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        <div className="mt-5 border-t border-white/10 pt-5 text-sm text-[var(--muted)]">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}

export default function MfaPage() {
  return (
    <Suspense fallback={null}>
      <MfaChallengeForm />
    </Suspense>
  );
}
