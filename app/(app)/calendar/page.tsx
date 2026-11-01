import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import LibraryTabs from "@/components/LibraryTabs";
import WorkCalendar from "@/components/WorkCalendar";

export default async function CalendarPage() {
  if (!await getAuthedUser()) redirect("/login");
  return <><LibraryTabs /><WorkCalendar /></>;
}
