import { notFound, redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { listVisibleMeetingsLight } from "@/lib/database";
import { parseParticipants } from "@/lib/participants";
import PersonDetailClient from "@/components/PersonDetailClient";

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const user = await getAuthedUser();
  if (!user) redirect("/login");

  const { name: encodedName } = await params;
  const name = decodeURIComponent(encodedName);

  const allMeetings = await listVisibleMeetingsLight();
  const meetings = allMeetings.filter((meeting) =>
    parseParticipants(meeting.participants).some(
      (p) => p.toLowerCase() === name.toLowerCase()
    )
  );

  if (meetings.length === 0) {
    notFound();
  }

  return <PersonDetailClient name={name} meetings={meetings} />;
}
