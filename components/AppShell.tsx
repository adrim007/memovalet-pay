import { Suspense } from "react";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";

export type ActiveNav =
  | "home"
  | "history"
  | "ask"
  | "tasks"
  | "insights"
  | "meeting"
  | "teams"
  | "documents"
  | "projects"
  | "people"
  | "settings";

interface AppShellProps {
  userEmail?: string;
  userName?: string;
  children: React.ReactNode;
}

export default function AppShell({ userEmail, userName, children }: AppShellProps) {
  return (
    <div className="app-shell-bg relative min-h-screen overflow-x-clip md:flex">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--background)] transition focus:translate-y-0"
      >
        Skip to main content
      </a>

      <Suspense fallback={null}>
        <Sidebar userEmail={userEmail} userName={userName} />
      </Suspense>

      <main id="main-content" tabIndex={-1} className="relative flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10 min-w-0">
        <div className="hidden md:block fixed top-6 right-8 z-40">
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}
