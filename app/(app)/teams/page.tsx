import { redirect } from "next/navigation";

export default async function TeamsPage() {
  redirect("/people?view=groups");
}
