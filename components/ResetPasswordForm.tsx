"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordStrength from "@/components/PasswordStrength";
import { MIN_PASSWORD, passwordStrength } from "@/lib/password-strength";
import { BREACHED_HINT, checkPasswordBreachedHere } from "@/lib/breached-password";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    const strength = passwordStrength(password);
    if (strength.unsafe) {
      setError(strength.hint);
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setSaving(true);
    setError("");

    // A new password that is already on the breach lists is no safer than the
    // one being replaced.
    if ((await checkPasswordBreachedHere(password)).breached) {
      setError(BREACHED_HINT);
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(
        updateError.code === "weak_password"
          ? "That password is too easy to guess. Try a longer one."
          : updateError.code === "same_password"
            ? "That's the password you already have. Choose a different one."
            : "We couldn't save that password. Please try again."
      );
      setSaving(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  const inputClasses =
    "w-full rounded-xl border border-white/20 bg-white/[0.07] px-3.5 py-3 text-base text-white placeholder:text-white/45 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/25";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-2 text-left">
      <input
        type="password"
        aria-label="New password"
        placeholder={`New password (${MIN_PASSWORD}+ characters)`}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        autoFocus
        minLength={MIN_PASSWORD}
        aria-describedby="new-password-strength"
        required
        className={inputClasses}
      />
      <PasswordStrength password={password} id="new-password-strength" />
      <input
        type="password"
        aria-label="Type the new password again"
        placeholder="Type it again"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        required
        className={inputClasses}
      />
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="!mt-3 w-full brand-gradient-bg text-white text-base font-semibold py-3 rounded-xl transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60 shadow-lg shadow-indigo-500/25"
      >
        {saving ? "Saving…" : "Save password and continue"}
      </button>
    </form>
  );
}
