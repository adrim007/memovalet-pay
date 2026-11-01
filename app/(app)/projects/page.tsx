import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { listUserProjects } from "@/lib/database";
import ProjectsClient from "@/components/ProjectsClient";

export default async function ProjectsPage() {
  const user = await getAuthedUser();
  if (!user) redirect("/login?next=%2Fprojects");

  const projects = await listUserProjects();

  return <ProjectsClient projects={projects} userId={user.id} />;
}
