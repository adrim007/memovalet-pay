import { featureError } from "@/lib/plan-access";
import Link from "next/link";
import { redirect } from "next/navigation";
import InsightsClient from "@/components/InsightsClient";
import { getAuthedUser } from "@/lib/auth";
import {
  getDocumentFolderCounts,
  listActionItems,
  listInsightsMeetings,
  listMyTaskAssignments,
  listUserProjects,
} from "@/lib/database";

export default async function InsightsPage() {
  const user = await getAuthedUser();
  if (!user) redirect("/login");

  const denied = await featureError(user.id, "reports");
  if (denied) return <section className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Reporting for your business</h1><p className="my-4">{denied}</p><Link href="/billing?plan=business" className="font-semibold text-indigo-600 underline">Compare your options</Link></section>;

  // The largest selectable range is 13 weeks. We fetch one matching prior
  // period too, so change calculations work without loading years of history.
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 26 * 7);
  const since = sinceDate.toISOString();
  const [meetings, actionItems, taskAssignments, projects, counts] = await Promise.all([
    listInsightsMeetings(since),
    listActionItems({ since, limit: 500 }),
    listMyTaskAssignments(user.id, 500, since),
    listUserProjects(),
    getDocumentFolderCounts(user.id),
  ]);

  return (
    <InsightsClient
      meetings={meetings}
      actionItems={actionItems}
      taskAssignments={taskAssignments}
      projects={projects}
      documentsCount={counts.documentsCount}
      foldersCount={counts.foldersCount}
    />
  );
}
