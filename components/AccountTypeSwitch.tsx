"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, User } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useAccountType } from "@/lib/account-type-context";
import type { AccountType } from "@/lib/types";

// A two-way Personal | Business switch. Saves straight to the account and
// refreshes the app so navigation and wording follow immediately.
export default function AccountTypeSwitch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const current = useAccountType();
  const [value, setValue] = useState<AccountType>(current);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const choose = async (next: AccountType) => {
    if (next === value || saving) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    setFailed(false);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { account_type: next } });
    if (error) {
      setValue(previous);
      setFailed(true);
    } else {
      router.refresh();
    }
    setSaving(false);
  };

  const options: { key: AccountType; label: string; icon: typeof User }[] = [
    { key: "personal", label: "Personal", icon: User },
    { key: "business", label: "Business", icon: Briefcase },
  ];

  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label="Account mode"
        className="grid grid-cols-2 rounded-xl border border-[var(--surface-border)] bg-white/70 p-1"
      >
        {options.map(({ key, label, icon: Icon }) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={saving}
              onClick={() => choose(key)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition disabled:opacity-70 ${
                selected
                  ? "brand-gradient-bg text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon size={14} weight={selected ? "fill" : "regular"} />
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 px-1 text-[11px] leading-4 text-[var(--muted)]">
        {failed ? "Unable to switch right now. Please try again." : saving ? "Switching…" : "Switch any time. Nothing is deleted."}
      </p>
    </div>
  );
}
