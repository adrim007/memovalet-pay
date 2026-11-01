function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card rounded-2xl px-4 py-3.5 md:px-5 md:py-4">
      <p className="text-2xl font-extrabold tracking-tight md:text-3xl">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--muted)] md:text-sm">{label}</p>
    </div>
  );
}

interface HomeHeaderProps {
  firstName: string;
  greeting?: string;
  showStats?: boolean;
  totalMeetings: number;
  meetingsThisWeek: number;
  totalActionItems: number;
  totalTasksSent: number;
}

export default function HomeHeader({
  firstName,
  greeting = "Good morning",
  showStats = true,
  totalMeetings,
  meetingsThisWeek,
  totalActionItems,
  totalTasksSent,
}: HomeHeaderProps) {
  return (
    <header className="relative">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
        {greeting}, <span className="brand-gradient-text capitalize">{firstName}</span>
      </h1>

      <p className="mt-1.5 text-sm text-[var(--muted)] md:text-base">
        Here&apos;s what needs your attention today.
      </p>

      {showStats && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard label="Meetings" value={totalMeetings} />
          <StatCard label="This week" value={meetingsThisWeek} />
          <StatCard label="Action items" value={totalActionItems} />
          <StatCard label="Tasks sent" value={totalTasksSent} />
        </div>
      )}
    </header>
  );
}
