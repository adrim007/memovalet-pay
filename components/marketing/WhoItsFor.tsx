import Link from "next/link";
import { ArrowRight, ChartLineUp, Code, Crown, GlobeHemisphereWest, Hammer, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { SOLUTIONS } from "@/lib/solutions";

/**
 * Who MemoValet is for — the same six the Solutions page explores, read from
 * the same list, so the home page and /solutions always agree.
 */
const ICONS = {
  global: GlobeHemisphereWest,
  sales: ChartLineUp,
  product: Code,
  people: UsersThree,
  leadership: Crown,
  field: Hammer,
} as const;

export default function WhoItsFor() {
  return (
    <section aria-labelledby="who-heading" className="relative px-5 py-20 sm:px-8 sm:py-28">
      <div className="pointer-events-none absolute bottom-0 left-[-12rem] h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/10 blur-[150px]" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8071ff]">Who it&rsquo;s for</p>
            <h2 id="who-heading" className="mt-5 text-balance font-display text-3xl font-light leading-[1.16] tracking-[-0.045em] text-white sm:text-5xl">
              For your life, <span className="text-[#bb99ff]">and for your business.</span>
            </h2>
            <p className="mt-5 text-base leading-7 text-white/62">
              Keep your own plans in order, run client work, or send a job to someone across town. Switch between personal and business whenever you like.
            </p>
          </div>
          <Link href="/solutions" className="inline-flex items-center gap-2 text-sm font-semibold text-[#c1adfa] transition hover:gap-3 hover:text-white">
            Explore solutions <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </Link>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((solution) => {
            const Icon = ICONS[solution.icon];
            return (
              <li key={solution.key}>
                <Link
                  href="/solutions"
                  className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#8071ff]/40 hover:bg-white/[0.055]"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#7755ef]/15 text-[#c1adfa] transition group-hover:bg-[#7755ef]/25">
                    <Icon size={24} weight="duotone" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold tracking-[-0.01em] text-white">{solution.label}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-white/60">{solution.title}</p>
                  <p className="mt-4 border-t border-white/[0.07] pt-4 text-[13px] leading-5 text-[#c9b8ff]/85">{solution.result}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
