import Link from "next/link";
import Logo from "@/components/Logo";

export default function MarketingFooter() {
  return (
    <footer className="relative mt-32 border-t border-white/8 px-6 py-14">
      <div className="mx-auto max-w-5xl flex flex-col md:flex-row md:items-start justify-between gap-10">
        <div className="max-w-xs">
          <Logo size="sm" href="/" brandName="MemoValet" />
          <p className="text-sm text-white/65 mt-4 leading-relaxed">
            Your personal assistant for tasks, promises, notes, files, people and meetings.
            Built for individuals, teams and the people they work with.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 text-sm">
          <div>
            <p className="font-semibold text-white/85 mb-3">Product</p>
            <div className="flex flex-col gap-2.5 text-white/65">
              <Link href="/" className="hover:text-white transition">
                Overview
              </Link>
              <Link href="/solutions" className="hover:text-white transition">
                Solutions
              </Link>
              <Link href="/integrations" className="hover:text-white transition">
                Integrations
              </Link>
              <Link href="/resources" className="hover:text-white transition">
                Resources
              </Link>
              <Link href="/pricing" className="hover:text-white transition">
                Pricing
              </Link>
            </div>
          </div>
          <div>
            <p className="font-semibold text-white/85 mb-3">Account</p>
            <div className="flex flex-col gap-2.5 text-white/65">
              <Link href="/login" className="hover:text-white transition">
                Log in
              </Link>
              <Link href="/login" className="hover:text-white transition">
                Get started
              </Link>
            </div>
          </div>
          <div>
            <p className="font-semibold text-white/85 mb-3">Legal</p>
            <div className="flex flex-col gap-2.5 text-white/65">
              <Link href="/privacy" className="hover:text-white transition">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white transition">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl mt-12 pt-6 border-t border-white/8 text-xs text-white/35 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>© {new Date().getFullYear()} MemoValet. All rights reserved.</span>
        <Link href="/privacy" className="hover:text-white/60 transition">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-white/60 transition">
          Terms
        </Link>
      </div>
    </footer>
  );
}
