import { redirect } from "next/navigation";
import {
  getAuthedUser,
  hasAnsweredSecurityPrompt,
  hasAuthenticator,
  needsMfaChallenge,
} from "@/lib/auth";
import { accountTypeOf, fullDisplayName, hasCompleteProfile } from "@/lib/displayName";
import { AccountTypeProvider } from "@/lib/account-type-context";
import AppShell from "@/components/AppShell";
import LocalDaySync from "@/components/LocalDaySync";

export const dynamic = "force-dynamic";
// Deliberately NOT the edge runtime. Edge ignores the `regions` pin in
// vercel.json and runs near the visitor, which put these pages in Sydney
// while Supabase sits in Tokyo — every query then paid a ~100ms crossing,
// and this route makes about a dozen of them. On Node they run in hnd1,
// in the same region as the database.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthedUser();
  if (!user) redirect("/login");
  if (await needsMfaChallenge()) redirect("/mfa");
  if (!hasCompleteProfile(user)) redirect("/complete-profile?next=/dashboard");
  // Asked once, straight after the profile: 2-step verification is far more
  // likely to get switched on when it's offered than when it's buried in Settings.
  if (!hasAnsweredSecurityPrompt(user) && !(await hasAuthenticator())) {
    redirect("/security-setup?next=/dashboard");
  }

  return (
    <AccountTypeProvider value={accountTypeOf(user)}>
      <LocalDaySync />
      <AppShell userEmail={user.email || ""} userName={fullDisplayName(user)}>
        {children}
      </AppShell>
    </AccountTypeProvider>
  );
}
