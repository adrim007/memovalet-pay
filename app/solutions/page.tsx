import type { Metadata } from "next";
import StarlightHero from "@/components/marketing/StarlightHero";
import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import SolutionsExplorer from "@/components/marketing/SolutionsExplorer";

export const metadata: Metadata = { title: "Solutions for Individuals and Teams | MemoValet", description: "Organise personal priorities, manage projects, coordinate clients and contractors, and keep team responsibilities clear with MemoValet.", alternates: { canonical: "https://memovalet.com/solutions" } };

export default function SolutionsPage() {
  return (
    <MarketingPageShell active="/solutions">
      <StarlightHero variant="solutions" />

      <SolutionsExplorer />
    </MarketingPageShell>
  );
}
