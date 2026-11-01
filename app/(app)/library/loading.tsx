export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse">
      <div className="grid gap-6 md:grid-cols-[232px_minmax(0,1fr)] md:gap-8">
        <div className="space-y-2">
          <div className="h-9 rounded-xl bg-[var(--surface-border)]" />
          <div className="h-8 rounded-xl bg-[var(--surface-border)]" />
          <div className="h-8 rounded-xl bg-[var(--surface-border)]" />
          <div className="h-8 rounded-xl bg-[var(--surface-border)]" />
        </div>
        <div>
          <div className="h-8 w-40 rounded bg-[var(--surface-border)]" />
          <div className="mt-2 h-4 w-56 rounded bg-[var(--surface-border)]" />
          <div className="mt-6 space-y-2">
            <div className="surface-card h-16 rounded-2xl" />
            <div className="surface-card h-16 rounded-2xl" />
            <div className="surface-card h-16 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
