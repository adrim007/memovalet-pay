import { createClient } from "@/lib/supabase/server";
import { getTeamInviteByToken } from "@/lib/database";
import Logo from "@/components/Logo";
import JoinTeamButton from "@/components/JoinTeamButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JoinTeamPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getTeamInviteByToken(token);

  let user = null;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    console.error("Failed to check auth session", err);
  }

  return (
    <div className="mk-dark relative min-h-screen overflow-hidden px-6 py-10 md:px-10 md:py-16 flex items-center justify-center">
      <div className="orb orb-a h-72 w-72 -top-10 left-[10%] bg-indigo-500/40" />
      <div className="orb orb-b h-96 w-96 top-1/3 -right-20 bg-fuchsia-500/30" />

      <div className="relative surface-card rounded-2xl p-8 max-w-sm w-full text-center shadow-xl shadow-indigo-500/5">
        <div className="flex justify-center mb-5">
          <Logo size="lg" href="/" />
        </div>

        {!invite && (
          <>
            <p className="font-medium mb-1">This invite link isn&apos;t valid</p>
            <p className="text-sm text-[var(--muted)]">It may have expired or already been used.</p>
          </>
        )}

        {invite && invite.accepted_at && (
          <>
            <p className="font-medium mb-1">Already used</p>
            <p className="text-sm text-[var(--muted)]">This invite has already been accepted.</p>
          </>
        )}

        {invite && !invite.accepted_at && (
          <>
            <p className="text-sm text-[var(--muted)] mb-6">
              You&apos;ve been invited to join{" "}
              <span className="font-medium text-[var(--foreground)]">
                {invite.team_name || "a group"}
              </span>{" "}
              on MemoValet.
            </p>

            {user ? (
              <JoinTeamButton token={token} />
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent("/teams/join/" + token)}`}
                className="w-full inline-block brand-gradient-bg text-white font-medium py-2.5 rounded-xl transition hover:opacity-90 active:scale-[0.99] shadow-lg shadow-indigo-500/25"
              >
                Log in to join
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
