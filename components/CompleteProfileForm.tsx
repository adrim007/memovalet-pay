"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AccountType } from "@/lib/types";

interface CompleteProfileFormProps {
  initialFirstName: string;
  initialLastName: string;
  initialAccountType?: AccountType | null;
  nextPath: string;
}

const ACCOUNT_TYPES: { value: AccountType; label: string; blurb: string }[] = [
  {
    value: "personal",
    label: "Personal",
    blurb: "Your own notes, reminders, errands and appointments.",
  },
  {
    value: "business",
    label: "Business",
    blurb: "Projects, clients, team assignments and meeting actions.",
  },
];

export default function CompleteProfileForm({
  initialFirstName,
  initialLastName,
  initialAccountType,
  nextPath,
}: CompleteProfileFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [accountType, setAccountType] = useState<AccountType | null>(initialAccountType ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    if (!cleanFirstName || !cleanLastName || !accountType || saving) return;

    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        first_name: cleanFirstName,
        last_name: cleanLastName,
        account_type: accountType,
        profile_completed: true,
      },
    });

    if (updateError) {
      setError("We couldn't save that. Please try again.");
      setSaving(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  };

  const inputClasses =
    "w-full rounded-xl border border-white/20 bg-white/[0.07] px-3.5 py-3 text-base text-white placeholder:text-white/45 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/25";

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4 text-left">
      <div>
        <label htmlFor="first-name" className="mb-1.5 block text-sm font-medium text-white">
          First name
        </label>
        <input
          id="first-name"
          name="first-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          autoComplete="given-name"
          autoFocus
          required
          maxLength={80}
          placeholder="Maya"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="last-name" className="mb-1.5 block text-sm font-medium text-white">
          Last name
        </label>
        <input
          id="last-name"
          name="last-name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          autoComplete="family-name"
          required
          maxLength={80}
          placeholder="Sharma"
          className={inputClasses}
        />
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-white">
          How will you use MemoValet?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACCOUNT_TYPES.map((option) => {
            const selected = accountType === option.value;
            return (
              <label
                key={option.value}
                className={`cursor-pointer rounded-xl border px-3.5 py-3 transition ${
                  selected
                    ? "border-indigo-300 bg-white/[0.14] ring-2 ring-indigo-300/30"
                    : "border-white/20 bg-white/[0.07] hover:bg-white/[0.1]"
                }`}
              >
                <input
                  type="radio"
                  name="account-type"
                  value={option.value}
                  checked={selected}
                  onChange={() => setAccountType(option.value)}
                  className="sr-only"
                />
                <span className="block text-base font-semibold text-white">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-white/70">{option.blurb}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-white/55">You can switch any time in Settings.</p>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !firstName.trim() || !lastName.trim() || !accountType}
        className="brand-gradient-bg w-full rounded-xl py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {saving ? "Saving…" : "Continue to MemoValet"}
      </button>
    </form>
  );
}
