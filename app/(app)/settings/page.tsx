import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { accountTypeOf } from "@/lib/displayName";
import { getStoredGoogleRefreshToken } from "@/lib/google/tokens";
import { getStripeAccountLink } from "@/lib/database";
import { isStripeConfigured } from "@/lib/stripe";
import SettingsClient from "@/components/SettingsClient";
import { getSlackConnection } from "@/lib/slack-connection";
import { getNotionConnection, notionConfigured } from "@/lib/notion-connection";
import { getTrelloConnection, trelloConfigured } from "@/lib/trello-connection";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  azure: "Microsoft",
  email: "Email and password",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ slack?: string; notion?: string; trello?: string; google?: string }> }) {
  const user = await getAuthedUser();
  if (!user) redirect("/login");

  const googleConnected = !!(await getStoredGoogleRefreshToken(user.id));
  const params = await searchParams;
  const [slack, notion, trello] = await Promise.all([
    getSlackConnection(user.id),
    getNotionConnection(user.id),
    getTrelloConnection(user.id),
  ]);
  const slackNotice = params.slack === "failed" ? "Slack wasn't connected. Try again, or ask your workspace admin to allow the app." : "";
  const notionNotice =
    params.notion === "failed"
      ? "Notion wasn't connected. Please try again."
      : params.notion === "nopage"
        ? "Connected, but no page was shared. Connect again and tick the page MemoValet should save meeting notes into."
        : "";
  const trelloNotice = params.trello === "failed" ? "Trello wasn't connected. Please try again." : "";
  const googleNotice =
    params.google === "taken"
      ? "That Google account is already connected to a different MemoValet account."
      : params.google === "failed"
        ? "Google wasn't connected. Please try again."
        : "";
  const signInMethod = PROVIDER_LABELS[user.app_metadata?.provider || ""] || "Email and password";
  const notificationPrefs = user.user_metadata?.notification_prefs || {};
  const stripeLink = isStripeConfigured() ? await getStripeAccountLink(user.id) : null;
  const stripe = {
    configured: isStripeConfigured(),
    connected: !!stripeLink,
    chargesEnabled: !!stripeLink?.charges_enabled,
    detailsSubmitted: !!stripeLink?.details_submitted,
  };

  return (
    <SettingsClient
      email={user.email || ""}
      firstName={user.user_metadata?.first_name || ""}
      lastName={user.user_metadata?.last_name || ""}
      accountType={accountTypeOf(user)}
      stripe={stripe}
      createdAt={user.created_at}
      signInMethod={signInMethod}
      googleConnected={googleConnected}
      googleLinked={!!user.identities?.some((identity) => identity.provider === "google")}
      googleNotice={googleNotice}
      slackConfigured={!!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY)}
      slackLabel={slack ? `${slack.team_name} · ${slack.channel_name}` : ""}
      slackNotice={slackNotice}
      integrationStatus={{
        trello: !!trello?.list_id,
        slack: !!slack,
        notion: !!notion?.parent_page_id,
      }}
      notion={{
        configured: notionConfigured(),
        connected: !!notion,
        label: notion ? (notion.parent_page_title ? `${notion.workspace_name} · ${notion.parent_page_title}` : notion.workspace_name) : "",
        needsPage: !!notion && !notion.parent_page_id,
        notice: notionNotice,
      }}
      trello={{
        configured: trelloConfigured(),
        connected: !!trello,
        member: trello?.member_name || "",
        listLabel: trello?.list_id ? `${trello.board_name ? trello.board_name + " › " : ""}${trello.list_name}` : "",
        notice: trelloNotice,
      }}
      notificationPrefs={{
        timed_reminders: notificationPrefs.timed_reminders !== false,
        task_completed: notificationPrefs.task_completed !== false,
        invite_accepted: notificationPrefs.invite_accepted !== false,
        task_due_soon: notificationPrefs.task_due_soon !== false,
        overdue_digest: notificationPrefs.overdue_digest !== false,
      }}
    />
  );
}
