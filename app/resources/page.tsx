import type { Metadata } from "next";
import StarlightHero from "@/components/marketing/StarlightHero";
import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import ResourceLibrary from "@/components/marketing/ResourceLibrary";
import { buildResourceDetail, buildResources, featuredResources, type ResourceCategory, type ResourceDetail } from "@/lib/marketing-resources";

export const metadata: Metadata = { title: "Guides for Your Workspace | MemoValet", description: "Learn how to use MemoValet for tasks, projects, notes, files, calendar history and collaboration.", alternates: { canonical: "https://memovalet.com/resources" } };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const query = await searchParams;
  const resources = buildResources();
  // Built on the server so the dialog can open instantly, with no fetch.
  const details: Record<string, ResourceDetail> = {};
  for (const item of [...featuredResources, ...resources]) {
    details[item.slug] = buildResourceDetail(item.slug);
  }
  const requestedCategory = query.category as ResourceCategory | undefined;
  const initialCategory = requestedCategory && ["Guides", "Comparisons"].includes(requestedCategory) ? requestedCategory : "All";

  return (
    <MarketingPageShell active="/resources">
      <StarlightHero variant="resources" />

      <ResourceLibrary featured={featuredResources} resources={resources} details={details} initialCategory={initialCategory} />
    </MarketingPageShell>
  );
}
