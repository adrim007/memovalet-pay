import AppShell from "@/components/AppShell";
import SettingsClient from "@/components/SettingsClient";

export default function SettingsPreviewPage() {
  return (
    <AppShell userEmail="maya@example.com" userName="Maya Sharma">
      <SettingsClient
        email="maya@example.com"
        firstName="Maya"
        lastName="Sharma"
        accountType="business"
        createdAt="2026-07-05T12:00:00.000Z"
        signInMethod="Google"
        googleConnected={true}
        integrationStatus={{ trello: false, slack: false, notion: false }}
        notificationPrefs={{ task_completed: true, invite_accepted: true, task_due_soon: false, overdue_digest: true }}
      />
    </AppShell>
  );
}
