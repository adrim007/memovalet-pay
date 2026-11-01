export default function PageLoading({ variant = "list" }: { variant?: "list" | "insights" | "settings" }) {
  return (
    <div className="mx-auto max-w-4xl animate-pulse" aria-label="Loading page" role="status">
      <div className="mb-2 h-8 w-48 rounded-lg bg-[var(--surface-border)]" />
      <div className="mb-7 h-4 w-80 max-w-full rounded bg-[var(--surface-border)]" />

      {variant === "insights" ? (
        <>
          <div className="surface-card mb-5 h-14 rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="surface-card h-80 rounded-2xl" />
            <div className="surface-card h-80 rounded-2xl" />
          </div>
        </>
      ) : variant === "settings" ? (
        <div className="space-y-4">
          <div className="surface-card h-16 rounded-2xl" />
          <div className="surface-card h-64 rounded-2xl" />
          <div className="surface-card h-52 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="surface-card h-16 rounded-2xl" />
          <div className="surface-card h-28 rounded-2xl" />
          <div className="surface-card h-28 rounded-2xl" />
        </div>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
