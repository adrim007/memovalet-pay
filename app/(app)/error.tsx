"use client";

import Link from "next/link";

// Keep the workspace navigation available when one section fails.
export default function WorkspaceError({ unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <section className="mx-auto mt-10 max-w-lg rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 shadow-sm" role="alert">
      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">Let’s try that again</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">This section couldn’t load</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Please retry. You can also use the navigation to open another section.</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={unstable_retry} className="brand-gradient-bg min-h-11 rounded-xl px-5 text-sm font-semibold text-white">Try again</button>
        <Link href="/dashboard" className="min-h-11 rounded-xl border border-[var(--surface-border)] px-5 py-3 text-sm font-semibold">Back to home</Link>
      </div>
    </section>
  );
}
