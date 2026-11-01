"use client";

import { List, X } from "@phosphor-icons/react";
import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

// Every item goes straight to its page. Solutions and Resources used to open
// hover menus, which just put a step between the click and the page.
const links = [
  { href: "/", label: "Overview" },
  { href: "/solutions", label: "Solutions" },
  { href: "/integrations", label: "Integrations" },
  { href: "/resources", label: "Resources" },
  { href: "/pricing", label: "Pricing" },
];

export default function MarketingNav({
  active,
  variant = "dark",
  framed = false,
}: {
  active?: string;
  variant?: "light" | "dark";
  framed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isLight = variant === "light";
  const quietLink = isLight
    ? "text-[#4d4762] hover:bg-[#7357f6]/6 hover:text-[#17142a]"
    : "text-white/65 hover:bg-white/5 hover:text-white";

  return (
    <header
      className={`${framed ? "memo-home-nav" : "sticky top-0"} z-50 border-b backdrop-blur-xl ${
        isLight
          ? "border-[#2d2450]/8 bg-[#f6f4ff]/88 text-[#17142a]"
          : "border-white/7 bg-[#050611]/88 text-white"
      }`}
    >
      <div className={`mx-auto flex max-w-[1487px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-[54px] ${framed ? "py-3" : "py-2"}`}>
        <Logo size="lg" href="/" pop brandName="MemoValet" />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active === link.href ? "page" : undefined}
              className={`rounded-xl px-3.5 py-2 text-sm font-normal transition ${
                active === link.href
                  ? isLight
                    ? "bg-[#7357f6]/8 text-[#5540d7]"
                    : "bg-white/8 text-white"
                  : quietLink
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className={`rounded-xl px-3.5 py-2 text-sm transition ${quietLink}`}>
            Log in
          </Link>
          <Link href="/login" className="mk-glow-btn rounded-full px-5 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]">
            Get started free
          </Link>
        </div>

        <button
          onClick={() => setOpen((value) => !value)}
          className={`flex h-10 w-10 items-center justify-center rounded-xl lg:hidden ${
            isLight ? "text-[#3b3452] hover:bg-[#7357f6]/8" : "text-white/80 hover:bg-white/5"
          }`}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X size={21} /> : <List size={21} />}
        </button>
      </div>

      {open && (
        <div
          className={`flex flex-col gap-1 border-t px-5 py-4 lg:hidden ${
            isLight
              ? "border-[#2d2450]/8 bg-[#f6f4ff] text-[#3b3452]"
              : "border-white/10 bg-[#070817] text-white"
          }`}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={active === link.href ? "page" : undefined}
              className={`block rounded-xl px-3.5 py-2.5 text-sm font-semibold ${quietLink}`}
            >
              {link.label}
            </Link>
          ))}
          <div className={`my-1.5 h-px ${isLight ? "bg-[#2d2450]/10" : "bg-white/10"}`} />
          <Link href="/login" onClick={() => setOpen(false)} className={`rounded-xl px-3.5 py-2.5 text-sm font-medium ${quietLink}`}>
            Log in
          </Link>
          <Link href="/login" onClick={() => setOpen(false)} className="mk-glow-btn rounded-full px-3.5 py-2.5 text-center text-sm font-semibold text-white">
            Get started free
          </Link>
        </div>
      )}
    </header>
  );
}
