"use client";

import {
  ArrowRight,
  ChartLineUp,
  CheckCircle,
  Code,
  Crown,
  GlobeHemisphereWest,
  Hammer,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SOLUTIONS } from "@/lib/solutions";

const iconMap = {
  global: GlobeHemisphereWest,
  sales: ChartLineUp,
  product: Code,
  people: UsersThree,
  leadership: Crown,
  field: Hammer,
};

const solutions = SOLUTIONS;

type SolutionKey = (typeof solutions)[number]["key"];

export default function SolutionsExplorer() {
  const [activeKey, setActiveKey] = useState<SolutionKey>("global-teams");
  const active = solutions.find((solution) => solution.key === activeKey) ?? solutions[0];
  const ActiveIcon = iconMap[active.icon];

  useEffect(() => {
    const syncHash = () => {
      const key = window.location.hash.slice(1) as SolutionKey;
      if (solutions.some((solution) => solution.key === key)) setActiveKey(key);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <section className="px-5 pb-24 sm:px-8 sm:pb-28" aria-labelledby="solution-explorer-heading">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="memo-section-label">Choose your work</p>
          <h2 id="solution-explorer-heading" className="mt-4 font-display text-3xl font-light tracking-[-0.045em] text-white sm:text-5xl">
            For your day, your projects and your business.
          </h2>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label="MemoValet solutions">
          {solutions.map((solution) => {
            const Icon = iconMap[solution.icon];
            const selected = solution.key === activeKey;
            return (
              <button key={solution.key} id={solution.key} type="button" role="tab" aria-selected={selected} aria-controls="solution-detail" className={`memo-solution-choice ${selected ? "is-active" : ""}`} onClick={() => setActiveKey(solution.key)}>
                <Icon size={22} weight="duotone" />
                <span><strong>{solution.label}</strong><small>{solution.eyebrow}</small></span>
                <ArrowRight size={16} className="ml-auto opacity-45" />
              </button>
            );
          })}
        </div>

        <div id="solution-detail" role="tabpanel" className="memo-solution-detail mt-5">
          <div>
            <span className="memo-feature-icon"><ActiveIcon size={30} weight="duotone" /></span>
            <p className="memo-section-label mt-7">{active.eyebrow}</p>
            <h3 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-4xl">{active.title}</h3>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/68">{active.body}</p>
          </div>
          <div className="rounded-[1.6rem] border border-white/10 bg-black/15 p-6 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">What you can do</p>
            <ul className="mt-5 space-y-4">
              {active.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-6 text-white/75"><CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-[#8f76ff]" />{point}</li>
              ))}
            </ul>
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a98aff]">The result</p>
              <p className="mt-2 text-sm leading-6 text-white/68">{active.result}</p>
            </div>
            <Link href="/login" className="mk-glow-btn mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white">Create your workspace <ArrowRight size={16} weight="bold" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
