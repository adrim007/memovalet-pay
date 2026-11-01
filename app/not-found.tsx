import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-16 flex items-center justify-center">
      <div className="orb orb-a h-72 w-72 -top-10 left-[10%] bg-indigo-500/40" />
      <div className="orb orb-b h-96 w-96 top-1/3 -right-20 bg-fuchsia-500/30" />
      <div className="relative surface-card rounded-2xl p-10 max-w-md text-center">
        <Logo size="md" href="/" />
        <p className="font-medium mt-6 mb-1">Page not found</p>
        <p className="text-sm text-[var(--muted)] mb-6">
          That page doesn&apos;t exist, or it moved.
        </p>
        <Link
          href="/"
          className="inline-block brand-gradient-bg text-white font-medium px-5 py-2.5 rounded-xl transition hover:opacity-90"
        >
          Back to MemoValet
        </Link>
      </div>
    </div>
  );
}
