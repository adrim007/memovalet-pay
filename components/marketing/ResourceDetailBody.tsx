"use client";

import { Check, Minus } from "@phosphor-icons/react";
import type { ResourceDetail } from "@/lib/marketing-resources";

// The body of a resource, shared by the library's dialog and the standalone
// /resources/[slug] page. Both used to carry their own copy of the text and
// the layout, and the copies drifted apart; now there is one of each.
export default function ResourceDetailBody({ detail }: { detail: ResourceDetail }) {
  return (
    <>
      {detail.kind === "comparison" && (
        <div className="space-y-6">
          <p className="leading-8 text-white/60">{detail.intro}</p>
          <div className="overflow-hidden rounded-3xl border border-white/10">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-white/8 px-4 py-4 text-xs font-semibold uppercase tracking-wide text-white/40 sm:px-6">
              <span>Feature</span>
              <span className="brand-gradient-text w-14 text-center sm:w-24">MemoValet</span>
              <span className="w-14 text-center sm:w-24">{detail.competitor}</span>
            </div>
            {detail.rows.map((row) => (
              <div
                key={row.feature}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-white/5 px-4 py-4 text-sm last:border-b-0 sm:px-6"
              >
                <span className="text-white/75">{row.feature}</span>
                <span className="flex w-14 justify-center text-emerald-400 sm:w-24">
                  <Check size={17} weight="bold" />
                </span>
                <span className="flex w-14 justify-center sm:w-24">
                  {row.other === true ? (
                    <span className="text-emerald-400"><Check size={17} weight="bold" /></span>
                  ) : row.other === "partial" ? (
                    <span className="text-white/35"><Minus size={17} weight="bold" /></span>
                  ) : (
                    <span className="text-xs text-white/25">&mdash;</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.kind === "guide" && (
        <div className="space-y-10">
          <p className="leading-8 text-white/60">{detail.intro}</p>
          <div className="space-y-6">
            {detail.steps.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <span className="brand-gradient-bg grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-white">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/55">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/40">
              {detail.benefitsHeading ?? "What every meeting gets"}
            </h3>
            <ul className="mt-4 space-y-3">
              {detail.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-sm text-white/70">
                  <span className="mt-0.5 shrink-0 text-emerald-400"><Check size={17} weight="bold" /></span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {detail.kind === "overview" && (
        <div className="space-y-8">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-white">{detail.heading ?? "What this resource covers"}</h3>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {detail.covers.map((item) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-black/10 p-4 text-sm text-white/72">
                  <Check size={18} weight="bold" className="mt-0.5 shrink-0 text-[#9d82ff]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">The useful takeaway</h3>
            <p className="mt-2 leading-8 text-white/60">{detail.takeaway}</p>
          </div>
        </div>
      )}
    </>
  );
}
