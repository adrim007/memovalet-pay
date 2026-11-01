import BillingPanel from "@/components/BillingPanel";
export default function BillingPreview() {
  return <main className="mx-auto max-w-3xl px-5 py-12"><p className="text-sm font-semibold text-indigo-600">BILLING PREVIEW</p><h1 className="mt-3 text-3xl font-bold">A plan that fits your work.</h1><p className="mt-4 text-[var(--muted)]">Continue with Free, or choose Member or Business and add your card for a 14 day trial. Paid plans renew after the trial unless you cancel.</p><BillingPanel ready={true} hasCustomer={false} hasSubscription={false} trialUsed={false} /></main>;
}
