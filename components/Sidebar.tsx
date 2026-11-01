"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useIsPersonal } from "@/lib/account-type-context";
import {
  Books,
  ChartBar,
  Gear,
  House,
  ListChecks,
  Users,
  UsersThree,
  VideoCamera,
} from "@phosphor-icons/react";
import SignOutButton from "./SignOutButton";
import AccountTypeSwitch from "./AccountTypeSwitch";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";
import { Team } from "@/lib/types";

type NavKey = "home" | "meeting" | "library" | "work" | "insights" | "people" | "settings";

function activeFromPath(pathname: string): NavKey | null {
  pathname = pathname.replace(/^\/preview(?=\/|$)/, "") || "/dashboard";
  if (pathname.startsWith("/ask")) return null;
  if (pathname.startsWith("/meeting") || pathname.startsWith("/live") || pathname.startsWith("/history")) return "meeting";
  // Files and Notes are views of the Library now (see LibraryTabs).
  if (pathname.startsWith("/library") || pathname.startsWith("/calendar") || pathname.startsWith("/documents") || pathname.startsWith("/notes")) return "library";
  if (pathname.startsWith("/tasks") || pathname.startsWith("/projects")) return "work";
  if (pathname.startsWith("/insights")) return "insights";
  if (pathname.startsWith("/people") || pathname.startsWith("/teams")) return "people";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}

interface SidebarProps {
  userEmail?: string;
  userName?: string;
}

const NAV_ITEMS = [
  { key: "home" as const, label: "Home", href: "/dashboard", icon: House },
  { key: "meeting" as const, label: "Meetings", href: "/meeting", icon: VideoCamera },
  { key: "library" as const, label: "Library", href: "/library", icon: Books },
  { key: "work" as const, label: "Work", href: "/tasks", icon: ListChecks },
  { key: "insights" as const, label: "Insights", href: "/insights", icon: ChartBar },
  { key: "people" as const, label: "People", href: "/people", icon: Users },
  { key: "settings" as const, label: "Settings", href: "/settings", icon: Gear },
];

export default function Sidebar({ userEmail, userName }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const personal = useIsPersonal();
  const active = activeFromPath(pathname);
  // Personal accounts don't need team workspaces in the way; wording changes too.
  const navItems = NAV_ITEMS;
  const labelFor = (item: (typeof NAV_ITEMS)[number]) =>
    personal && item.key === "work" ? "Tasks" : item.label;
  const activeTeamId = searchParams.get("team");
  const sampleScenario = pathname.startsWith("/preview") && searchParams.get("scenario") === "launch";
  const to = (href: string) => sampleScenario ? `${href === "/dashboard" ? "/preview" : `/preview${href}`}?scenario=launch` : href;
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teams")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.teams)) setTeams(data.teams);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const suffix = activeTeamId ? `?team=${activeTeamId}` : "";

  return (
    <aside className="workspace-sidebar relative flex w-full flex-wrap items-center gap-3 border-b border-[var(--surface-border)] p-4 md:sticky md:top-0 md:h-dvh md:flex-nowrap md:w-64 md:shrink-0 md:flex-col md:items-stretch md:gap-8 md:overflow-y-auto md:border-b-0 md:border-r md:p-6">
      <div className="shrink-0 md:self-start">
        <Logo size="sm" href={to("/dashboard")} wordmarkClassName="hidden md:inline" />
      </div>

      <nav data-tour="nav" className="order-last flex min-w-0 basis-full gap-1 overflow-x-auto md:order-none md:basis-auto md:mt-4 md:flex-none md:flex-col md:overflow-visible" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const label = labelFor(item);
          const href = item.key === "home" || item.key === "meeting" ? `${item.href}${suffix}` : item.href;
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              data-tour={`nav-${item.key}`}
              href={to(href)}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              className={`flex min-h-11 shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 md:flex-row md:gap-3 md:px-3.5 md:py-2.5 text-[15px] font-semibold transition ${
                isActive
                  ? "brand-gradient-bg text-white shadow-lg shadow-indigo-500/20"
                  : "text-[var(--muted)] hover:bg-indigo-500/5 hover:text-[var(--foreground)]"
              }`}
            >
              <Icon size={19} weight={isActive ? "fill" : "regular"} />
              <span className="text-[10px] md:text-[15px]">{label}</span>
            </Link>
          );
        })}
      </nav>

      {!personal && <div className="hidden md:block">
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Workspace</p>
        <div className="flex flex-col gap-1">
          <Link href="/dashboard" className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${!activeTeamId ? "bg-indigo-500/10" : "text-[var(--muted)] hover:bg-indigo-500/5"}`}>My workspace</Link>
          {teams.map((team) => (
            <Link key={team.id} href={`/dashboard?team=${team.id}`} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${activeTeamId === team.id ? "bg-indigo-500/10" : "text-[var(--muted)] hover:bg-indigo-500/5"}`}>
              <UsersThree size={17} /><span className="truncate">{team.name}</span>
            </Link>
          ))}
          <Link href="/people?view=groups" className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-indigo-500/5">+ Manage groups</Link>
        </div>
      </div>}

      <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0 md:mt-auto md:flex-col md:items-stretch">
        <AccountTypeSwitch className="hidden md:block" />
        {userEmail && (<>
          <Link href="/billing" className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Billing<span className="hidden md:inline">&nbsp;and subscription</span></Link>
          <Link href="/settings" className="hidden items-center gap-2.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2.5 transition hover:border-indigo-300 md:flex">
            <span className="brand-gradient-bg grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white">{(userName || userEmail).charAt(0).toUpperCase()}</span>
            <span className="truncate text-sm font-semibold" title={userEmail}>{userName || userEmail}</span>
          </Link>
        </>)}
        <div className="md:hidden"><NotificationBell /></div>
        <SignOutButton />
      </div>
    </aside>
  );
}
