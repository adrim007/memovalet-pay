"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Stage = "ask" | "scan" | "done";

// Shown once, right after someone finishes their profile. Settings → Security
// still has the same switch for anyone who says "not now" and changes their mind.
export default function SecuritySetup({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("ask");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Recorded either way, so the question is asked once and never nags.
  const markAnswered = async () => {
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { security_prompted: true } });
  };

  const continueOn = () => {
    router.replace(nextPath);
    router.refresh();
  };

  const skip = async () => {
    if (busy) return;
    setBusy(true);
    await markAnswered();
    continueOn();
  };

  const startSetup = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const supabase = createClient();

    // A setup abandoned halfway (tab closed on the QR screen) leaves an
    // unverified factor behind, and a stale one can block a fresh enrolment.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const factor of existing?.all ?? []) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    if (enrollError || !data) {
      setError("We couldn't start the setup. Please try again.");
      setBusy(false);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStage("scan");
    setBusy(false);
  };

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId || code.length !== 6 || busy) return;
    setBusy(true);
    setError("");

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (verifyError) {
      setError("That code was not accepted. Codes change every 30 seconds. Please enter the current code.");
      setCode("");
      setBusy(false);
      return;
    }

    await markAnswered();
    setStage("done");
    setBusy(false);
  };

  const cancelSetup = async () => {
    if (factorId) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setFactorId(null);
    setQrCode("");
    setSecret("");
    setCode("");
    setError("");
    setStage("ask");
  };

  const primaryButton =
    "w-full brand-gradient-bg text-white text-base font-semibold py-3 rounded-xl transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60 shadow-lg shadow-indigo-500/25";

  if (stage === "done") {
    return (
      <div className="mt-6">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-400/20 text-2xl [text-shadow:none]">
          ✓
        </div>
        <h1 className="mt-4 text-xl font-semibold text-white">2-step verification is on</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Next time you log in, you&apos;ll enter your password and then the code from your
          authenticator app. Keep access to your authenticator app so you can
          sign in when needed.
        </p>
        <button type="button" onClick={continueOn} className={`${primaryButton} mt-6`}>
          Continue to MemoValet
        </button>
      </div>
    );
  }

  if (stage === "scan") {
    return (
      <form onSubmit={confirm} className="mt-6">
        <h1 className="text-xl font-semibold text-white">Scan this with your authenticator app</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Open Google Authenticator, Microsoft Authenticator or Authy, tap <strong>+</strong>, and
          scan the code.
        </p>

        {qrCode && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrCode}
            alt="QR code to add MemoValet to your authenticator app"
            className="mx-auto mt-5 h-44 w-44 rounded-2xl bg-white p-2.5"
          />
        )}
        {secret && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Setting up on this phone? Enter this key instead:{" "}
            <span className="select-all break-all font-mono text-white">{secret}</span>
          </p>
        )}

        <label className="mt-5 block text-left text-sm font-medium text-white">
          Then enter the 6-digit code it shows
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            autoFocus
            className="mt-1.5 w-full rounded-xl border border-white/20 bg-white/[0.07] px-3.5 py-3 text-center text-lg tracking-[0.5em] text-white placeholder:text-white/40 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/25"
          />
        </label>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || code.length !== 6} className={`${primaryButton} mt-4`}>
          {busy ? "Checking…" : "Add an extra verification step"}
        </button>
        <button
          type="button"
          onClick={cancelSetup}
          disabled={busy}
          className="mt-3 text-sm font-medium text-[var(--muted)] hover:text-white"
        >
          ← Back
        </button>
      </form>
    );
  }

  return (
    <div className="mt-6">
      <h1 className="text-xl font-semibold text-white">Add 2-step verification?</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Your meetings, recordings and notes are private. 2-step verification means that even if
        someone learns your password, they still can&apos;t get in without your phone.
      </p>

      <ul className="mt-5 space-y-2.5 rounded-2xl border border-white/15 bg-white/[0.05] p-4 text-left text-sm text-[var(--muted)]">
        <li className="flex gap-2.5">
          <span className="text-white">1.</span>
          <span>
            Install a free authenticator app, such as <strong className="text-white">Google Authenticator</strong>,{" "}
            <strong className="text-white">Microsoft Authenticator</strong> or{" "}
            <strong className="text-white">Authy</strong>
          </span>
        </li>
        <li className="flex gap-2.5">
          <span className="text-white">2.</span>
          <span>Scan a code we show you</span>
        </li>
        <li className="flex gap-2.5">
          <span className="text-white">3.</span>
          <span>When you log in, enter the six digit code shown in the app</span>
        </li>
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button type="button" onClick={startSetup} disabled={busy} className={`${primaryButton} mt-6`}>
        {busy ? "Starting…" : "Set up in 2 minutes"}
      </button>
      <button
        type="button"
        onClick={skip}
        disabled={busy}
        className="mt-3 w-full py-2 text-sm font-medium text-[var(--muted)] hover:text-white disabled:opacity-60"
      >
        Not now
      </button>
      <p className="mt-2 text-xs text-[var(--muted)]">
        You can turn it on any time in Settings → Security.
      </p>
    </div>
  );
}
