import { notFound } from "next/navigation";
import { getLiveSessionForHost, getLiveSessionPublic } from "@/lib/database";
import { createClient } from "@/lib/supabase/server";
import { fullDisplayName } from "@/lib/displayName";
import LiveSessionClient from "@/components/LiveSessionClient";

export const dynamic = "force-dynamic";

export default async function LiveSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getLiveSessionPublic(id);

  if (!session) {
    notFound();
  }

  // Whoever started the meeting arrives here straight from "Start live
  // meeting", so we already know their name — asking them to type it again is
  // a form they'd only ever confirm. Guests following the share link aren't
  // signed in, and still get the join screen.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Known before the page loads, so the host's End button works from the first
  // moment instead of acting like a guest's until a check comes back.
  const initialCanManage = user ? !!(await getLiveSessionForHost(session.id, user.id)) : false;

  return (
    <LiveSessionClient
      sessionId={session.id}
      title={session.title}
      meetingType={session.meetingType}
      initialStatus={session.status}
      scheduledDurationMinutes={session.durationMinutes}
      initialName={user ? fullDisplayName(user) : undefined}
      initialCanManage={initialCanManage}
    />
  );
}
