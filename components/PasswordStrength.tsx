"use client";

import { passwordStrength, type PasswordLevel } from "@/lib/password-strength";

const BAR: Record<PasswordLevel, string> = {
  short: "bg-white/30",
  weak: "bg-red-400",
  fair: "bg-amber-400",
  good: "bg-lime-400",
  strong: "bg-emerald-400",
};

const TEXT: Record<PasswordLevel, string> = {
  short: "text-white/60",
  weak: "text-red-300",
  fair: "text-amber-300",
  good: "text-lime-300",
  strong: "text-emerald-300",
};

/**
 * How strong the password being typed is, under the box, while it is typed.
 * Four blocks and a word: weak, fair, good, strong — plus the one thing that
 * would improve it.
 */
export default function PasswordStrength({
  password,
  email,
  name,
  id,
}: {
  password: string;
  email?: string;
  name?: string;
  /** So the password box can point at this with aria-describedby. */
  id?: string;
}) {
  if (!password) return null;
  const strength = passwordStrength(password, { email, name });
  const filled = strength.level === "short" ? 0 : Math.max(1, strength.score);

  return (
    <div id={id} className="space-y-1.5 pt-0.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((block) => (
            <span
              key={block}
              className={`h-1.5 flex-1 rounded-full transition-colors ${block <= filled ? BAR[strength.level] : "bg-white/15"}`}
            />
          ))}
        </div>
        {strength.label && (
          <span className={`shrink-0 text-xs font-semibold ${TEXT[strength.level]}`}>{strength.label}</span>
        )}
      </div>
      {/* Spoken by screen readers as it settles, rather than on every keystroke. */}
      <p role="status" aria-live="polite" className="text-xs leading-5 text-white/65">
        <span className="sr-only">{strength.label ? `Password strength: ${strength.label}. ` : ""}</span>
        {strength.hint}
      </p>
    </div>
  );
}
