export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-4 w-32 rounded bg-[var(--surface-border)] mb-6" />

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="h-7 w-64 rounded bg-[var(--surface-border)]" />
        <div className="h-7 w-24 rounded bg-[var(--surface-border)]" />
      </div>

      <div className="space-y-4">
        <div className="surface-card rounded-2xl h-48" />
        <div className="surface-card rounded-2xl h-32" />
        <div className="surface-card rounded-2xl h-40" />
      </div>
    </div>
  );
}
