import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import AskClient from "@/components/AskClient";

// Ask, as Maya sees it. Answers come from /api/ask, which needs an account,
// so on its own this page shows the question box and the empty state. The
// walkthrough film's capture (media-src/energy-ad/scripts/capture-walkthrough.mjs)
// answers for the API with Maya's demo data.
export default async function AskPreviewPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const sampleMemory = (await searchParams).scenario === "launch";
  return (
    <AppShell userEmail="maya@example.com" userName="Maya">
      {sampleMemory && <p className="mx-auto mb-5 max-w-3xl text-xs text-[var(--muted)]">Sample workspace · fictional meeting · sourced answers through MCP</p>}
      <Suspense fallback={null}>
        <AskClient sampleMemory={sampleMemory} />
      </Suspense>
    </AppShell>
  );
}
