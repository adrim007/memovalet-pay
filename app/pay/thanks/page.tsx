import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = { title: "Payment received" };

export default function PaymentThanksPage() {
  return (
    <main className="mk-dark login-bg relative flex min-h-screen items-center justify-center px-6 py-10">
      <section className="relative w-full max-w-md text-center text-white">
        <div className="flex justify-center">
          <Logo size="lg" href="/" pop />
        </div>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight">Thanks — payment received</h1>
        <p className="mt-3 text-base leading-6 text-[#dcd7f0]">
          Your receipt is on its way from Stripe. The business has been told you&apos;ve paid.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-xl border border-white/25 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          What is MemoValet?
        </Link>
      </section>
    </main>
  );
}
