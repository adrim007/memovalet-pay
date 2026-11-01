import { notFound } from "next/navigation";
import { acceptLiveSessionInvite, createNotification, getHostEmail } from "@/lib/database";
import { sendAppEmail } from "@/lib/email/send";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await acceptLiveSessionInvite(id);

  if (!session) {
    notFound();
  }

  const hostEmail = await getHostEmail(session.created_by);
  if (hostEmail) {
    try {
      await sendAppEmail({
        to: hostEmail,
        subject: "Invite accepted: " + session.title,
        text:
          (session.invite_email || "Your invitee") +
          ' accepted your invite for "' +
          session.title +
          '".',
        userId: session.created_by,
      });
    } catch (err) {
      console.error(err);
    }
  }

  await createNotification({
    userId: session.created_by,
    type: "invite_accepted",
    title: `${session.invite_email || "Someone"} accepted your invite for "${session.title}"`,
    link: `/live/${id}`,
  });

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-16 flex items-center justify-center">
      <div className="orb orb-a h-72 w-72 -top-10 left-[10%] bg-indigo-500/40" />
      <div className="orb orb-b h-96 w-96 top-1/3 -right-20 bg-fuchsia-500/30" />
      <div className="relative surface-card rounded-2xl p-10 max-w-md text-center">
        <Logo size="md" href="/" />
        <p className="font-medium mt-6 mb-1">
          You&apos;re confirmed for &quot;{session.title}&quot;
        </p>
        <p className="text-sm text-[var(--muted)] mb-6">
          The host has been notified. Use the link they sent you to join when it starts.
        </p>
        <a
          href={`/live/${id}`}
          className="inline-block brand-gradient-bg text-white font-medium px-5 py-2.5 rounded-xl transition hover:opacity-90"
        >
          Go to the session
        </a>
      </div>
    </div>
  );
}
