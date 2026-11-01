export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse">
      <div className="h-8 w-24 rounded bg-[var(--surface-border)] mb-1" />
      <div className="h-4 w-80 rounded bg-[var(--surface-border)] mb-6" />
      <div className="space-y-2">
        <div className="surface-card rounded-2xl h-14" />
        <div className="surface-card rounded-2xl h-14" />
        <div className="surface-card rounded-2xl h-14" />
        <div className="surface-card rounded-2xl h-14" />
      </div>
    </div>
  );
}
