import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { listActionItems, listCommitments, listMyTaskAssignments } from "@/lib/database";
import TasksClient from "@/components/TasksClient";
import { calendarSourceItem } from "@/lib/calendar-source-item";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ task?: string; tab?: string }> }) {
  const user = await getAuthedUser();
  if (!user) redirect("/login");

  const [items, assignments, iOwe, theyOwe] = await Promise.all([
    listActionItems(),
    listMyTaskAssignments(user.id),
    listCommitments("i_owe"),
    listCommitments("they_owe"),
  ]);
  const params = await searchParams;
  if (params.task && !items.some((item) => item.id === params.task)) {
    const selected = await calendarSourceItem("action_items", params.task);
    if (selected) items.unshift(selected);
  }

  return (
    <>
      {params.task && !items.some((item) => item.id === params.task) && <p role="alert" className="mb-4 rounded-xl bg-amber-500/10 p-4 text-sm">This task was removed or is no longer shared with you.</p>}
      <TasksClient key={JSON.stringify(params)} items={items} assignments={assignments} iOwe={iOwe} theyOwe={theyOwe} />
    </>
  );
}
