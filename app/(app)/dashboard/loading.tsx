export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="max-w-4xl mx-auto">
        <div className="h-8 w-64 rounded bg-[var(--surface-border)] mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="surface-card rounded-2xl h-20" />
          <div className="surface-card rounded-2xl h-20" />
          <div className="surface-card rounded-2xl h-20" />
          <div className="surface-card rounded-2xl h-20" />
        </div>

        <div className="surface-card rounded-2xl h-14 mb-8" />

        <div className="h-6 w-40 rounded bg-[var(--surface-border)] mb-3" />
        <div className="space-y-3 mb-8">
          <div className="surface-card rounded-2xl h-24" />
          <div className="surface-card rounded-2xl h-24" />
          <div className="surface-card rounded-2xl h-24" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="h-8 w-40 rounded bg-[var(--surface-border)] mb-6" />

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="surface-card rounded-2xl h-56" />
          <div className="surface-card rounded-2xl h-56" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="surface-card rounded-2xl h-40" />
          <div className="surface-card rounded-2xl h-40" />
        </div>
      </div>
    </div>
  );
}
