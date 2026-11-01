export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse">
      <div className="h-8 w-32 rounded bg-[var(--surface-border)] mb-1" />
      <div className="h-4 w-72 rounded bg-[var(--surface-border)] mb-6" />
      <div className="surface-card rounded-2xl h-16 mb-6" />
      <div className="space-y-2">
        <div className="surface-card rounded-2xl h-16" />
        <div className="surface-card rounded-2xl h-16" />
        <div className="surface-card rounded-2xl h-16" />
      </div>
    </div>
  );
}
