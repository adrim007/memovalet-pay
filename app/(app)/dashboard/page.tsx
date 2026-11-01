import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { LOCAL_DAY_COOKIE, homeTimeZone } from "@/lib/local-day";
import { getAuthedUser } from "@/lib/auth";
import { accountTypeOf } from "@/lib/displayName";
import { firstDisplayName } from "@/lib/displayName";
import { getAttentionItems } from "@/lib/attention";
import {
  getDashboardStats,
  listDocuments,
  listMyTaskAssignments,
  listUserProjects,
} from "@/lib/database";
import HomeWorkspace from "@/components/HomeWorkspace";
import { shouldOfferWelcome } from "@/lib/onboarding";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  const user = await getAuthedUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const timeZone = homeTimeZone(cookieStore.get(LOCAL_DAY_COOKIE)?.value, headerStore.get("x-vercel-ip-timezone"));

  // Load only the information visible on Home. Deeper lists load on their own pages.
  const [attentionItems, stats, recentDocuments, projects, taskAssignments] = await Promise.all([
    getAttentionItems(user.id, 5, timeZone),
    getDashboardStats(),
    listDocuments(user.id, 3),
    listUserProjects(1, "active"),
    listMyTaskAssignments(user.id, 1, undefined, "pending"),
  ]);

  return (
    <HomeWorkspace
      firstName={firstDisplayName(user)}
      onboarding={{
        userId: user.id,
        showInitially: shouldOfferWelcome(user.user_metadata?.onboarding_completed, Boolean(stats.totalMeetings || stats.totalActionItems || stats.totalTasksSent || recentDocuments.length || projects.length || taskAssignments.length)),
        replayRequested: query.tour === "1",
      }}
      savedLayout={user.user_metadata?.home_layout}
      accountType={accountTypeOf(user)}
      totalMeetings={stats.totalMeetings}
      meetingsThisWeek={stats.meetingsThisWeek}
      totalActionItems={stats.totalActionItems}
      totalTasksSent={stats.totalTasksSent}
      recentDocuments={recentDocuments}
      activeProject={projects.find((project) => project.status === "active") || null}
      activeTask={taskAssignments.find((task) => task.status === "pending") || null}
      priorities={attentionItems.map((item) => ({
        title: item.title,
        description: item.description,
        type: item.type,
        href: item.sourceType === "commitment" ? (item.type === "commitment_overdue_they_owe" ? "/tasks?tab=waiting-on" : "/tasks?tab=i-owe") : item.sourceType === "action_item" ? `/tasks?task=${encodeURIComponent(item.sourceId)}#task-${encodeURIComponent(item.sourceId)}` : item.sourceType === "task_assignment" ? `/assigned/${encodeURIComponent(item.sourceId)}` : "/tasks",
        reminderId: item.sourceType === "reminder" ? item.sourceId : undefined,
      }))}
    />
  );
}
