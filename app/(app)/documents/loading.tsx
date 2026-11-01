export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-8 w-40 rounded bg-[var(--surface-border)] mb-6" />

      <div className="surface-card rounded-2xl h-48 mb-6" />

      <div className="space-y-2">
        <div className="surface-card rounded-2xl h-16" />
        <div className="surface-card rounded-2xl h-16" />
        <div className="surface-card rounded-2xl h-16" />
      </div>
    </div>
  );
}
