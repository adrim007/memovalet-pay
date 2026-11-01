import Logo from "@/components/Logo";

export const metadata = { title: "Payment not completed" };

export default function PaymentCancelledPage() {
  return (
    <main className="mk-dark login-bg relative flex min-h-screen items-center justify-center px-6 py-10">
      <section className="relative w-full max-w-md text-center text-white">
        <div className="flex justify-center">
          <Logo size="lg" href="/" pop />
        </div>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight">Payment not completed</h1>
        <p className="mt-3 text-base leading-6 text-[#dcd7f0]">
          Nothing was charged. The link in your email still works whenever you&apos;re ready.
        </p>
      </section>
    </main>
  );
}
