"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Books, CalendarBlank, FileText, NotePencil } from "@phosphor-icons/react";

// Saved work stays together, whether browsed by type or by date.
const TABS = [
  { label: "Everything", path: "/library", icon: Books },
  { label: "Calendar", path: "/calendar", icon: CalendarBlank },
  { label: "Files", path: "/documents", icon: FileText },
  { label: "Notes", path: "/notes", icon: NotePencil },
];

export default function LibraryTabs({ base = "" }: { base?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Library" className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--surface-border)] md:pr-16">
      {TABS.map(({ label, path, icon: Icon }) => {
        const href = `${base}${path}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={path}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
              active
                ? "border-indigo-600 text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:border-[var(--surface-border)] hover:text-[var(--foreground)]"
            }`}
          >
            <Icon size={18} weight={active ? "fill" : "regular"} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
