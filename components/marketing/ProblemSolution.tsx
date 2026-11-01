import { ArrowRight, Check, X } from "@phosphor-icons/react/dist/ssr";

/**
 * What people are missing, and what MemoValet does about it, side by side.
 *
 * MemoValet is a personal assistant for work and life, so this runs across
 * everything it does, with meetings as one row among six. Each "solved" line
 * is something that works today:
 * - the promises list is kept by the person (it is not pulled out of calls);
 * - a task link takes a note and one photo back, with no account;
 * - Ask answers from the person's own tasks, notes, files and meetings, and
 *   "What did I promise to do this week?" is one of its own suggestions.
 */
const ROWS = [
  {
    missing: "A promise made on Monday is forgotten by Friday.",
    solved: "Keep a list of what you owe people and what they owe you. Anything overdue shows up on your dashboard.",
  },
  {
    missing: "The note is in one app, the file in another, and the date is somewhere in your inbox.",
    solved: "Notes, files, tasks and your calendar live together, with a space for each client, project or part of your life.",
  },
  {
    missing: "Every morning starts with working out what is due.",
    solved: "Open MemoValet and your day is already laid out: what needs you, what's next and what's on today.",
  },
  {
    missing: "Getting a job done means chasing people who won't sign up for yet another app.",
    solved: "Send the task as a link. They open it, mark it done and send back a note and a photo, without an account.",
  },
  {
    missing: "You know you saved it somewhere. You just can't find it.",
    solved: "Just ask. “What did I promise to do this week?” MemoValet answers from your own tasks, notes, files and meetings.",
  },
  {
    missing: "After a meeting, nobody remembers what was decided.",
    solved: "MemoValet takes the notes, translates as people speak, and hands you the summary and action items.",
  },
];

export default function ProblemSolution() {
  return (
    <section id="whats-missing" aria-labelledby="missing-heading" className="relative scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
      <div className="pointer-events-none absolute left-1/2 top-24 h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[150px]" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8071ff]">What’s missing</p>
          <h2 id="missing-heading" className="mt-5 text-balance font-display text-3xl font-light leading-[1.16] tracking-[-0.045em] text-white sm:text-5xl">
            Your life is spread across a dozen apps. <span className="text-[#bb99ff]">MemoValet pulls it back together.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/62">
            A to-do list here, notes there, a calendar, an inbox, and whatever you are trying to remember. Things fall through the gaps. This is what gets lost, and what MemoValet does about it.
          </p>
        </div>

        <div className="mt-14 hidden grid-cols-[1fr_auto_1fr] gap-6 px-6 text-xs font-bold uppercase tracking-[0.16em] md:grid" aria-hidden="true">
          <span className="text-white/40">What people are missing</span>
          <span className="w-10" />
          <span className="text-[#a78bfa]">What MemoValet solves</span>
        </div>

        <ul className="mt-6 space-y-3 md:mt-4">
          {ROWS.map(({ missing, solved }) => (
            <li
              key={missing}
              className="group grid gap-3 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 transition duration-300 hover:border-[#8071ff]/35 hover:bg-white/[0.045] md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-6 md:px-6"
            >
              <p className="flex gap-3 text-[15px] leading-6 text-white/50">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/40">
                  <X size={13} weight="bold" aria-hidden="true" />
                </span>
                <span><span className="sr-only">Missing: </span>{missing}</span>
              </p>
              <ArrowRight size={20} weight="bold" className="hidden text-[#8071ff]/60 transition group-hover:translate-x-1 group-hover:text-[#a78bfa] md:block" aria-hidden="true" />
              <p className="flex gap-3 text-[15px] leading-6 text-white">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7755ef] to-[#b04fd8] text-white shadow-md shadow-[#7755ef]/30">
                  <Check size={13} weight="bold" aria-hidden="true" />
                </span>
                <span><span className="sr-only">Solved: </span>{solved}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
