import type { Metadata } from "next";
import IntegrationsDirectory from "@/components/marketing/IntegrationsDirectory";
import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import StarlightHero from "@/components/marketing/StarlightHero";

export const metadata: Metadata = { title: "Connected Tools | MemoValet", description: "Explore supported MemoValet connections for calendars, documents, messages and meeting records. Check availability for each tool.", alternates: { canonical: "https://memovalet.com/integrations" } };

export default function IntegrationsPage() {
  return (
    <MarketingPageShell active="/integrations">
      <StarlightHero variant="integrations" />
      <IntegrationsDirectory
        availability={{
          slack: Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET),
          notion: Boolean(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET),
          trello: Boolean(process.env.TRELLO_API_KEY),
        }}
      />
    </MarketingPageShell>
  );
}
