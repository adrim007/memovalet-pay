export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-8 w-40 rounded bg-[var(--surface-border)] mb-6" />

      <div className="flex gap-2 mb-6">
        <div className="h-9 w-20 rounded-xl bg-[var(--surface-border)]" />
        <div className="h-9 w-28 rounded-xl bg-[var(--surface-border)]" />
        <div className="h-9 w-20 rounded-xl bg-[var(--surface-border)]" />
      </div>

      <div className="space-y-2">
        <div className="surface-card rounded-2xl h-16" />
        <div className="surface-card rounded-2xl h-16" />
        <div className="surface-card rounded-2xl h-16" />
        <div className="surface-card rounded-2xl h-16" />
      </div>
    </div>
  );
}
