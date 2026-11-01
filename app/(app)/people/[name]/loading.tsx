export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-4 w-20 rounded bg-[var(--surface-border)] mb-3" />
      <div className="h-9 w-40 rounded bg-[var(--surface-border)] mb-6" />

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="surface-card rounded-2xl h-20" />
        <div className="surface-card rounded-2xl h-20" />
      </div>

      <div className="h-4 w-24 rounded bg-[var(--surface-border)] mb-3" />
      <div className="space-y-3">
        <div className="surface-card rounded-2xl h-20" />
        <div className="surface-card rounded-2xl h-20" />
      </div>
    </div>
  );
}
