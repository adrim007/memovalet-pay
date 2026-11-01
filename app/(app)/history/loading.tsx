export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="h-8 w-52 rounded bg-[var(--surface-border)]" />
        <div className="h-9 w-32 rounded-xl bg-[var(--surface-border)]" />
      </div>

      <div className="space-y-2">
        <div className="surface-card rounded-2xl h-20" />
        <div className="surface-card rounded-2xl h-20" />
        <div className="surface-card rounded-2xl h-20" />
        <div className="surface-card rounded-2xl h-20" />
      </div>
    </div>
  );
}
