import BillingSeats from "@/components/BillingSeats";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedUser, needsMfaChallenge } from "@/lib/auth";
import { billingAccount, billingReady, refreshBilling, withBillingLock } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { hasBillingAccess } from "@/lib/billing-plans";
import BillingPanel from "@/components/BillingPanel";
import Logo from "@/components/Logo";
export const dynamic = "force-dynamic";
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; plan?: string; interval?: string }> }) {
  const params = await searchParams;
  const user = await getAuthedUser();
  const query = new URLSearchParams();
  if (params.plan) query.set("plan", params.plan);
  if (params.interval) query.set("interval", params.interval);
  if (!user) redirect(`/login?mode=signup&next=${encodeURIComponent('/billing' + (query.size ? '?' + query : ''))}`);
  if (await needsMfaChallenge()) redirect("/mfa?next=/billing");
  const ready = billingReady();
  let account = null;
  let error = "";
  {
    try {
      account = await billingAccount(user.id);
      if (account?.customer_id && getStripe()) account = await withBillingLock(user.id, async () => refreshBilling(getStripe()!, (await billingAccount(user.id))!));
    } catch { error = "Your billing status could not be refreshed. Please reload this page before starting a subscription."; }
  }
  return <main className="min-h-screen bg-[var(--background)] px-5 py-10 text-[var(--foreground)]">
    <div className="mx-auto max-w-3xl"><Logo href="/" size="sm" />
      <div className="mt-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-lg shadow-indigo-500/5 sm:p-10">
        <p className="text-sm font-semibold text-indigo-600">MEMOVALET BILLING</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{account?.subscription_id ? "Your plan, in one place." : "A plan that fits your work."}</h1>
        <p className="mt-4 text-[var(--muted)]">{account?.trial_used ? "Manage your subscription, payment details and cancellation below." : "Continue with Free, or choose Member or Business and add your card for a 14 day trial. Paid plans renew after the trial unless you cancel."}</p>
        {!ready && !account?.subscription_id && <p role="status" className="mt-6 rounded-xl bg-amber-500/10 p-4">Card setup is not available yet. Subscription registration will open when payment setup is complete.</p>}
        {error && <p role="alert" className="mt-6 rounded-xl bg-red-500/10 p-4">{error}</p>}
        {params.checkout === "cancelled" && <p role="status" className="mt-4">Checkout was cancelled. You can choose a plan when you are ready.</p>}
        {params.checkout === "complete" && ready && !account?.subscription_id && !error && <p role="status" className="mt-4">We are waiting for Stripe to confirm your subscription. Reload this page shortly. Please do not start another checkout.</p>}
        {account?.subscription_id && <div className="mt-6 rounded-xl bg-indigo-500/5 p-5">
          <p className="font-semibold">{account.plan === "business" ? "Business" : "Member"} · {account.status === "trialing" ? "Free trial" : account.status.replaceAll("_", " ")}</p>
          {account.trial_ends_at && <p className="mt-2 text-sm">Trial ends {new Date(account.trial_ends_at).toLocaleDateString("en-AU", { timeZone: "UTC", dateStyle: "long" })} (UTC).</p>}
          {account.cancel_at_period_end && <p className="mt-2 text-sm">Your subscription is set to cancel at the end of the current billing period.</p>}
          {hasBillingAccess(account) && <Link href="/dashboard" className="mt-4 inline-block font-semibold text-indigo-600 underline">Open your workspace</Link>}
        </div>}
        <BillingPanel ready={ready && !error && !(params.checkout === "complete" && !account?.subscription_id)} hasCustomer={!!account?.customer_id} hasSubscription={!!account?.subscription_id && !["canceled", "incomplete_expired"].includes(account.status)} trialUsed={!!account?.trial_used} initialPlan={params.plan} initialInterval={params.interval} />
        {ready && <BillingSeats ready={ready} />}
        <p className="mt-6 text-sm text-[var(--muted)]">Card details are handled by Stripe. MemoValet does not store your full card number or security code.</p>
        <div className="mt-6 flex flex-wrap gap-5 text-sm"><Link href="/pricing" className="underline">Compare plans</Link><Link href="/dashboard" className="underline">Back to workspace</Link><a href="mailto:adrian.kulatunga@gmail.com" className="underline">Contact support</a></div>
      </div>
    </div>
  </main>;
}
