import AppShell from "@/components/AppShell";
import HomeClient from "@/components/HomeClient";

export default function MeetingPreviewPage() {
  return (
    <AppShell userEmail="maya@example.com" userName="Maya">
      <HomeClient
        activeTeamId={null}
        activeTeamName={null}
        googleConnected={false}
        integrations={{ google: false, trello: false, slack: false, notion: false }}
      />
    </AppShell>
  );
}
