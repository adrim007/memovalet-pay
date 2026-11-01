import { notFound, redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { getProject, getUserLabel, listProjectMeetings } from "@/lib/database";
import ProjectDetailClient from "@/components/ProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthedUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [project, meetings] = await Promise.all([getProject(id), listProjectMeetings(id)]);

  if (!project) {
    notFound();
  }

  const sharedByLabel = project.created_by !== user.id ? await getUserLabel(project.created_by) : null;

  return (
    <ProjectDetailClient
      project={project}
      meetings={meetings}
      currentUserId={user.id}
      sharedByLabel={sharedByLabel}
    />
  );
}
