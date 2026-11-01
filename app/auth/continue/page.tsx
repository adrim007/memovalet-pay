import { redirect } from "next/navigation";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) || "";
}

// Where an emailed sign-up or reset link lands, via /auth/confirm. Nothing on
// this page spends the link: work email security opens every link in a message
// before the person does, so the one-time token is only used when someone
// presses the button, which posts back to /auth/confirm. Scanners follow links;
// they don't press buttons.
export default async function ContinuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const tokenHash = first(params.token_hash);
  const type = first(params.type);
  const next = first(params.next);

  if (!tokenHash) redirect("/login?error=link");

  const isReset = type === "recovery";

  return (
    <main className="mk-dark login-bg relative flex min-h-screen items-center justify-center overflow-clip px-6 py-10 md:px-10 md:py-16">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      <section className="relative w-full max-w-sm text-center font-sans [text-shadow:0_1px_4px_rgba(0,0,0,0.55)] [--muted:#dcd7f0]">
        <div className="flex justify-center">
          <Logo size="lg" href="/" pop />
        </div>
        <h1 className="mt-6 text-xl font-semibold text-white">
          {isReset ? "Reset your password" : "Confirm your email"}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          {isReset ? "Continue to choose a new password." : "One click and your account is ready."}
        </p>

        <form method="post" action="/auth/confirm" className="mt-6">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          {next && <input type="hidden" name="next" value={next} />}
          <button
            type="submit"
            className="w-full brand-gradient-bg text-white text-base font-semibold py-3 rounded-xl transition hover:opacity-90 active:scale-[0.99] shadow-lg shadow-indigo-500/25"
          >
            {isReset ? "Continue" : "Confirm email"}
          </button>
        </form>

        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
          This extra click stops work email scanners from using up your link before you can.
        </p>
      </section>
    </main>
  );
}
