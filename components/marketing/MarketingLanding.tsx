import Link from "next/link";
import "./MarketingAtmosphere.css";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import MarketingAuthRedirect from "./MarketingAuthRedirect";
import MarketingFooter from "./MarketingFooter";
import MarketingNav from "./MarketingNav";
import MeetingHero from "./MeetingHero";
import ProblemSolution from "./ProblemSolution";
import DashboardShowcase from "./DashboardShowcase";
import WhoItsFor from "./WhoItsFor";
import TranslationShowcase from "./TranslationShowcase";
import MarketingShowcase from "./MarketingShowcase";
import PrivateByDesign from "./PrivateByDesign";
import CursorConstellation from "./CursorConstellation";

/**
 * The home page of a personal assistant — not a meeting app. In the order a
 * visitor needs it: what MemoValet is, what people are missing and what it
 * solves, the dashboard itself, who it is for, then meetings as one of its
 * skills (the languages, the call itself and the brief it produces, grouped
 * together after the assistant story), and why it is safe to keep your life
 * in it.
 *
 * One <main> for the whole page. There used to be two — one for the hero and
 * one for the rest — which leaves screen readers with two "main content"
 * landmarks and no way to know which is the real one.
 */
export default function MarketingLanding() {
  return (
    <div className="memo-home-stage">
      <MarketingAuthRedirect />
      <div className="memo-home-shell memo-starlight-shell mk-dark overflow-x-hidden">
        <MarketingNav active="/" variant="dark" framed />
        <main id="main-content">
          <MeetingHero />
        </main>
      </div>

      <div className="memo-home-lower mk-dark overflow-x-hidden">
        <CursorConstellation
          scopeSelector=".memo-home-lower"
          className="memo-page-constellation"
          parallax={false}
          cursorLight={false}
        />
        {/* The rest of the page's content. Each section is a named region,
            so it stays reachable by landmark without a second <main>. */}
        <div>
          <ProblemSolution />
          <DashboardShowcase />
          <WhoItsFor />
          <TranslationShowcase />
          <MarketingShowcase />
          <PrivateByDesign />

          <section aria-labelledby="closing-heading" className="px-5 pb-16 pt-6 sm:px-8 sm:pb-24">
            <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-[#2a1d5c] via-[#1a1538] to-[#120f26] px-7 py-16 text-center shadow-[0_50px_140px_-60px_rgba(119,85,239,0.8)] sm:px-12 sm:py-20">
              <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8b6cff]/35 blur-[100px]" aria-hidden="true" />
              <h2 id="closing-heading" className="relative text-balance font-display text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Hand it to MemoValet.
                <span className="block text-[#c9b4ff]">Get back to your day.</span>
              </h2>
              <p className="relative mx-auto mt-5 max-w-lg text-sm leading-6 text-white/65 sm:text-base">
                Start with a free workspace. Add a task, send a job, ask a question, and see what it takes off your plate.
              </p>
              <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/login?mode=signup" className="mk-glow-btn inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5">
                  Get started free
                  <ArrowRight size={17} weight="bold" />
                </Link>
                <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-white/85 transition hover:border-white/35 hover:text-white">
                  See pricing
                </Link>
              </div>
            </div>
          </section>
        </div>
        <MarketingFooter />
      </div>
    </div>
  );
}
