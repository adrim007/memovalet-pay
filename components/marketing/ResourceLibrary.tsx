"use client";

import {
  ArrowRight,
  BookOpenText,
  CheckCircle,
  MagnifyingGlass,
  Scales,
} from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { useDeferredValue, useState } from "react";
import ResourceDialog, { type ResourceDialogItem } from "@/components/marketing/ResourceDialog";
import type { FeaturedResource, ResourceCategory, ResourceDetail } from "@/lib/marketing-resources";

type ResourceItem = {
  slug: string;
  category: ResourceCategory;
  title: string;
  body: string;
  readingTime: string;
};

const categoryIcons = {
  Comparisons: Scales,
  Guides: BookOpenText,
};

const categories: Array<ResourceCategory | "All"> = ["All", "Guides", "Comparisons"];

export default function ResourceLibrary({ featured, resources, details, initialCategory = "All" }: { featured: FeaturedResource[]; resources: ResourceItem[]; details: Record<string, ResourceDetail>; initialCategory?: ResourceCategory | "All" }) {
  // Only categories the library actually has: a tab that always shows an empty
  // list, or exactly what "All" shows, is noise.
  const presentCategories = categories.filter((c) => c === "All" || resources.some((r) => r.category === c));
  const showFilters = presentCategories.length > 2;
  const [active, setActive] = useState<ResourceCategory | "All">(
    presentCategories.includes(initialCategory) ? initialCategory : "All"
  );
  const [query, setQuery] = useState("");
  const [openResource, setOpenResource] = useState<ResourceDialogItem | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const open = (item: { slug: string; category: ResourceCategory; title: string; body: string }) =>
    setOpenResource({ ...item, detail: details[item.slug] });

  const filtered = resources.filter((resource) => {
    const matchesCategory = active === "All" || resource.category === active;
    const matchesQuery = !deferredQuery || `${resource.title} ${resource.body} ${resource.category}`.toLowerCase().includes(deferredQuery);
    return matchesCategory && matchesQuery;
  });

  return (
    <>
      <section className="px-5 pb-20 sm:px-8 sm:pb-24" aria-labelledby="featured-resources-heading">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-6">
            <div><p className="memo-section-label">Start here</p><h2 id="featured-resources-heading" className="mt-4 font-display text-3xl font-light tracking-[-0.045em] text-white sm:text-5xl">Make the most of your workspace.</h2></div>
          </div>
          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {featured.map((resource, index) => {
              const Icon = categoryIcons[resource.category];
              return (
                <button key={resource.slug} type="button" onClick={() => open(resource)} className={`memo-featured-resource-card text-left ${index === 0 ? "lg:col-span-2 lg:row-span-2 lg:min-h-[720px]" : "memo-featured-resource-card-small"}`} style={{ "--resource-gradient": resource.gradient } as CSSProperties}>
                  <span className="memo-featured-resource-art" aria-hidden="true"><Icon size={index === 0 ? 64 : 48} weight="duotone" /></span>
                  <span className="relative z-10 flex h-full flex-col">
                    <span className="memo-section-label">{resource.category}</span>
                    <strong className={`mt-5 max-w-xl font-display font-semibold leading-tight tracking-[-0.04em] text-white ${index === 0 ? "text-3xl sm:text-4xl" : "text-2xl"}`}>{resource.title}</strong>
                    <span className="mt-4 max-w-xl text-sm leading-7 text-white/65">{resource.body}</span>
                    {index === 0 ? (
                      <span className="mt-9 grid max-w-xl gap-3 sm:grid-cols-2">
                        {["Plan your first task", "Save notes and files", "Explore your calendar", "Find your way around the dashboard"].map((item) => (
                          <span key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm leading-6 text-white/72">
                            <CheckCircle size={19} weight="fill" className="mt-0.5 shrink-0 text-[#9d82ff]" />
                            {item}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-semibold text-white">Read resource <ArrowRight size={16} weight="bold" /></span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 bg-black/10 px-5 py-20 sm:px-8 sm:py-24" aria-labelledby="resource-library-heading">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="memo-section-label">Resource library</p><h2 id="resource-library-heading" className="mt-4 font-display text-3xl font-light tracking-[-0.045em] text-white sm:text-5xl">Guidance for your everyday work.</h2></div>
            <label className="memo-integration-search"><MagnifyingGlass size={19} /><span className="sr-only">Search resources</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guides and resources" /></label>
          </div>

          {showFilters && <div className="mt-8 flex flex-wrap gap-2" aria-label="Filter resources">
            {presentCategories.map((category) => <button key={category} type="button" className={`memo-filter-pill ${active === category ? "is-active" : ""}`} aria-pressed={active === category} onClick={() => setActive(category)}>{category}</button>)}
          </div>}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((resource) => {
              const Icon = categoryIcons[resource.category];
              return (
                <button key={resource.slug} type="button" onClick={() => open(resource)} className="memo-resource-card group text-left">
                  <span className="memo-feature-icon"><Icon size={27} weight="duotone" /></span>
                  <span className="memo-section-label mt-6">{resource.category}</span>
                  <strong className="mt-3 block text-lg leading-snug text-white">{resource.title}</strong>
                  <span className="mt-3 block text-sm leading-6 text-white/56">{resource.body}</span>
                  <span className="mt-auto flex items-center justify-end pt-7 text-xs text-white/42"><ArrowRight size={17} className="transition group-hover:translate-x-1 group-hover:text-white" /></span>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-white/14 px-6 py-14 text-center text-sm text-white/55">No resource matches that search yet.</div> : null}
        </div>
      </section>

      {openResource ? <ResourceDialog resource={openResource} onClose={() => setOpenResource(null)} /> : null}
    </>
  );
}
