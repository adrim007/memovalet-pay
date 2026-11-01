import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import SecuritySetup from "@/components/SecuritySetup";
import {
  getAuthedUser,
  hasAnsweredSecurityPrompt,
  hasAuthenticator,
  needsMfaChallenge,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export default async function SecuritySetupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = safeNextPath((await searchParams).next);
  const user = await getAuthedUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (await needsMfaChallenge()) redirect(`/mfa?next=${encodeURIComponent(nextPath)}`);
  // Already protected, or already answered: nothing to ask.
  if (hasAnsweredSecurityPrompt(user) || (await hasAuthenticator())) redirect(nextPath);

  return (
    <main className="mk-dark login-bg relative flex min-h-screen items-center justify-center overflow-clip px-6 py-10 md:px-10 md:py-16">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      <section className="relative w-full max-w-md rounded-[1.75rem] border border-white/15 bg-[#151129]/90 p-6 text-center font-sans shadow-[0_32px_90px_rgba(3,1,15,0.55)] backdrop-blur-2xl sm:p-8 [--muted:#dcd7f0]">
        <div className="flex justify-center">
          <Logo size="lg" href="/" pop wordmarkClassName="text-white" />
        </div>
        <SecuritySetup nextPath={nextPath} />
      </section>
    </main>
  );
}
