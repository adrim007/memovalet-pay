import { getAuthedUser } from "@/lib/auth";
import { getStoredGoogleRefreshToken } from "@/lib/google/tokens";
import { listUserTeams } from "@/lib/database";
import { getSlackConnection } from "@/lib/slack-connection";
import { getNotionConnection, notionConfigured } from "@/lib/notion-connection";
import { getTrelloConnection, trelloConfigured } from "@/lib/trello-connection";
import HomeClient from "@/components/HomeClient";

export default async function MeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const user = await getAuthedUser();

  // Layout already redirects unauthenticated users before this renders.
  if (!user) return null;

  const [teams, googleToken, slack, notion, trello] = await Promise.all([
    listUserTeams(user.id),
    getStoredGoogleRefreshToken(user.id),
    getSlackConnection(user.id),
    getNotionConnection(user.id),
    getTrelloConnection(user.id),
  ]);
  const activeTeam = teamParam ? teams.find((t) => t.id === teamParam) || null : null;
  const googleConnected = !!googleToken;

  // Each person's own connections, and only once they're usable: Notion needs a
  // shared page to save into, Trello a chosen list.
  const integrations = {
    google: googleConnected,
    slack: !!slack,
    notion: !!notion?.parent_page_id,
    trello: !!trello?.list_id,
  };
  // Not ready yet, but finishing is one click away in Settings.
  const connectable = {
    slack: !slack && !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET),
    notion: !integrations.notion && notionConfigured(),
    trello: !integrations.trello && trelloConfigured(),
  };

  return (
    <HomeClient
      activeTeamId={activeTeam ? activeTeam.id : null}
      activeTeamName={activeTeam ? activeTeam.name : null}
      googleConnected={googleConnected}
      integrations={integrations}
      connectable={connectable}
    />
  );
}
