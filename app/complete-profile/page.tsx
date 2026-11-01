import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import CompleteProfileForm from "@/components/CompleteProfileForm";
import { getAuthedUser } from "@/lib/auth";
import { hasCompleteProfile, suggestedProfileNames } from "@/lib/displayName";

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const user = await getAuthedUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (hasCompleteProfile(user)) redirect(nextPath);

  const { firstName, lastName } = suggestedProfileNames(user);

  return (
    <main className="mk-dark login-bg relative flex min-h-screen items-center justify-center overflow-clip px-6 py-10 md:px-10 md:py-16">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />
      <div className="login-blob login-blob-4" />
      <div className="login-blob login-blob-5" />
      <div className="login-blob login-blob-6" />

      <section className="relative w-full max-w-md px-1 text-center font-sans [text-shadow:0_1px_4px_rgba(0,0,0,0.55)] [--muted:#dcd7f0]">
        <div className="flex justify-center">
          <Logo size="lg" href="/" pop />
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">
            One quick step
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
            Let&apos;s set you up
          </h1>
          <p className="mt-3 text-base leading-6 text-[#dcd7f0]">
            Confirm your name and tell us whether this is for you or for your business, so MemoValet
            shows the right things.
          </p>
        </div>

        <CompleteProfileForm
          initialFirstName={firstName}
          initialLastName={lastName}
          initialAccountType={
            user.user_metadata?.account_type === "business" ||
            user.user_metadata?.account_type === "personal"
              ? user.user_metadata.account_type
              : null
          }
          nextPath={nextPath}
        />

        <p className="mt-5 text-center text-xs leading-5 text-white/55">
          You can change this later in Settings.
        </p>
      </section>
    </main>
  );
}
