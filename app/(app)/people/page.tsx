import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { listUserTeams, listVisibleMeetingsLight } from "@/lib/database";
import { parseParticipants } from "@/lib/participants";
import PeopleClient from "@/components/PeopleClient";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const user = await getAuthedUser();
  if (!user) redirect("/login?next=%2Fpeople");

  const [meetings, teams, query] = await Promise.all([
    listVisibleMeetingsLight(),
    listUserTeams(user.id),
    searchParams,
  ]);

  // Count meetings per person and remember the most recent one, so the card
  // can say when you last spoke rather than just how often.
  const byName = new Map<string, { meetingCount: number; lastMet: string | null; email: string | null }>();

  for (const meeting of meetings) {
    for (const name of parseParticipants(meeting.participants)) {
      const existing = byName.get(name) || { meetingCount: 0, lastMet: null, email: null };
      existing.meetingCount += 1;
      if (!existing.lastMet || meeting.created_at > existing.lastMet) {
        existing.lastMet = meeting.created_at;
      }
      if (!existing.email && name.includes("@")) existing.email = name;
      byName.set(name, existing);
    }
  }

  const people = Array.from(byName.entries())
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => b.meetingCount - a.meetingCount);

  return (
    <PeopleClient
      people={people}
      teams={teams}
      userId={user.id}
      initialView={query.view === "groups" ? "groups" : "people"}
    />
  );
}
