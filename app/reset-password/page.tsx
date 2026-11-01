import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import ResetPasswordForm from "@/components/ResetPasswordForm";
import { getAuthedUser, needsMfaChallenge } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const user = await getAuthedUser();
  // Only reachable through a reset link, which signs the user in first.
  if (!user) redirect("/login?error=reset-link");
  // Supabase won't change the password of an account with an authenticator
  // until that code has been entered — so ask for it before the form, not after.
  if (await needsMfaChallenge()) redirect("/mfa?next=/reset-password");

  return (
    <main className="mk-dark login-bg relative flex min-h-screen items-center justify-center overflow-clip px-6 py-10 md:px-10 md:py-16">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      <section className="relative w-full max-w-sm text-center font-sans [text-shadow:0_1px_4px_rgba(0,0,0,0.55)] [--muted:#dcd7f0]">
        <div className="flex justify-center">
          <Logo size="lg" href="/" pop />
        </div>
        <h1 className="mt-6 text-xl font-semibold text-white">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          For <span className="font-medium text-white">{user.email}</span>
        </p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
