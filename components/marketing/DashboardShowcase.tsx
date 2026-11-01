import DashboardFilm, { type DashboardPart } from "./DashboardFilm";

/**
 * The dashboard itself, as it looks, with what each part does. A real
 * screenshot of /preview (the demo account, Maya), taken from a production
 * build at 2x; retake it when Home changes shape, and move the markers to
 * match. Positions are percentages of the image, so they hold at any width.
 * The screenshot is also the cover of the walkthrough film: press it
 * and the film plays in its place (DashboardFilm).
 */
const PARTS: DashboardPart[] = [
  {
    title: "Ask or tell",
    body: "Ask about your own work, search the web, or type or say “Call Sarah Friday” and it goes on your list.",
    at: { left: "20.3%", top: "23.8%" },
  },
  {
    title: "Quick actions",
    body: "Send a task, write a note, start a meeting or share a file in one click.",
    at: { left: "19.8%", top: "41.6%" },
  },
  {
    title: "Needs you",
    body: "Overdue promises, things due today and today’s appointments, in one list.",
    at: { left: "31%", top: "48.5%" },
  },
  {
    title: "Up next",
    body: "The job you’re on, who it’s with, and your schedule for the day.",
    at: { left: "69.8%", top: "48.5%" },
  },
  {
    title: "Personal or business",
    body: "Switch between your life and your business. Nothing is deleted.",
    at: { left: "1.9%", top: "76.4%" },
  },
];

export default function DashboardShowcase() {
  return (
    <section aria-labelledby="dashboard-heading" className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-[#7755ef]/15 blur-[160px]" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8071ff]">Your dashboard</p>
          <h2 id="dashboard-heading" className="mt-5 text-balance font-display text-3xl font-light leading-[1.16] tracking-[-0.045em] text-white sm:text-5xl">
            Your whole day, <span className="text-[#bb99ff]">on one screen.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/62">
            Open MemoValet and it has already sorted your day. Ask it anything, tell it what to do, and see what needs you before it turns into a problem.
          </p>
        </div>

        <DashboardFilm parts={PARTS} />

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PARTS.map((part, index) => (
            <li key={part.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#7755ef] to-[#c04fd8] text-xs font-bold text-white" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-white">{part.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-white/58">{part.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
