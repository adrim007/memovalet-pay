import { notFound } from "next/navigation";
import { getTaskAssignmentPublic } from "@/lib/database";
import AssignedTaskClient from "@/components/AssignedTaskClient";

export const dynamic = "force-dynamic";

export default async function AssignedTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await getTaskAssignmentPublic(id);

  if (!assignment) {
    notFound();
  }

  return <AssignedTaskClient assignment={assignment} />;
}
