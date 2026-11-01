export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse">
      <div className="mb-8 space-y-3">
        <div className="h-4 w-52 rounded bg-[var(--surface-border)]" />
        <div className="h-10 w-44 rounded bg-[var(--surface-border)]" />
        <div className="h-5 w-full max-w-xl rounded bg-[var(--surface-border)]" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)] lg:gap-8">
        <div className="surface-card h-[38rem] rounded-3xl" />
        <div className="space-y-6">
          <div className="surface-card h-40 rounded-2xl" />
          <div className="surface-card h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
