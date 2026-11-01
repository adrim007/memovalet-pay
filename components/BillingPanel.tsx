"use client";
import Link from "next/link";
import { useState } from "react";
import { BILLING_PLANS, type BillingPlan, type BillingInterval } from "@/lib/billing-plans";
export default function BillingPanel({ ready, hasCustomer, hasSubscription, trialUsed, initialPlan, initialInterval }: { ready: boolean; hasCustomer: boolean; hasSubscription: boolean; trialUsed: boolean; initialPlan?: string; initialInterval?: string }) {
  const [plan, setPlan] = useState<BillingPlan>(initialPlan === "business" ? "business" : "member");
  const [interval, setInterval] = useState<BillingInterval>(initialInterval === "year" ? "year" : "month");
  const [seats, setSeats] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = BILLING_PLANS[plan];
  const amount = interval === "year" ? selected.yearly : selected.monthly;
  async function open(kind: "checkout" | "portal") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/billing/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, interval, seats: plan === "business" ? seats : 1 }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Secure billing could not be opened.");
      window.location.assign(data.url);
    } catch (err) { setError(err instanceof Error ? err.message : "Please try again."); setBusy(false); }
  }
  return <div className="mt-7">
    <div className="mb-6 rounded-xl border border-[var(--surface-border)] p-4"><h2 className="font-semibold">Free · US$0</h2><p className="mt-2 text-sm text-[var(--muted)]">Keep your personal workspace for as long as you like.</p><Link href="/dashboard" className="mt-3 inline-flex min-h-11 items-center font-semibold text-indigo-600 underline">Continue to your workspace</Link>{hasSubscription && <p className="mt-2 text-sm">Opening your workspace does not cancel a paid subscription. Use Manage billing below to cancel.</p>}</div>
    {!hasSubscription && <>
      <fieldset disabled={busy || !ready} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Choose your plan</legend>
        {Object.entries(BILLING_PLANS).map(([key,value]) => <label key={key} className={`cursor-pointer rounded-xl border p-4 ${plan === key ? "border-indigo-500 bg-indigo-500/5" : "border-[var(--surface-border)]"}`}><input type="radio" name="plan" value={key} checked={plan===key} onChange={()=>setPlan(key as BillingPlan)} className="mr-2 accent-indigo-600" />{value.name}<span className="mt-2 block text-sm text-[var(--muted)]">US${interval === "year" ? value.yearly : value.monthly} per {interval}{key === "business" ? " per user" : ""}</span></label>)}
      </fieldset>
      <label className="mt-5 block text-sm font-semibold">Billing period<select disabled={busy || !ready} value={interval} onChange={e=>setInterval(e.target.value as BillingInterval)} className="mt-2 block min-h-11 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3"><option value="month">Monthly</option><option value="year">Yearly</option></select></label>
      {plan === "business" && <label className="mt-5 block text-sm font-semibold">Paid seats, including you<input type="number" min={1} max={50} step={1} disabled={busy || !ready} value={seats} onChange={e=>setSeats(Number(e.target.value))} className="mt-2 block min-h-11 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3"/><span className="mt-2 block font-normal text-[var(--muted)]">Assign purchased seats to your group members in Billing. Guests can join calls without a paid seat.</span></label>}
      <p className="my-5 text-sm leading-6">{trialUsed ? "Your free trial has already been used." : "14 days free. Card required."} {trialUsed ? "Pay" : "Then pay"} <strong>US${amount * (plan === "business" ? seats : 1)} per {interval}{plan === "business" ? ` for ${seats} paid ${seats === 1 ? "seat" : "seats"}` : ""}</strong>. Your subscription renews automatically until you cancel. {interval === "year" ? "The full annual amount is charged at each renewal." : "You are charged once each month."} You can cancel through Manage billing.</p>
      <button disabled={!ready || busy || !Number.isInteger(seats) || seats < 1 || seats > 50} onClick={()=>open("checkout")} className="min-h-12 w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Opening secure billing…" : trialUsed ? "Continue to payment" : "Add card and start 14 day trial"}</button>
    </>}
    {hasCustomer && <button disabled={busy} onClick={()=>open("portal")} className="mt-4 min-h-12 w-full rounded-xl border border-[var(--surface-border)] px-5 py-3 font-semibold disabled:opacity-50">Manage billing, card or cancellation</button>}
    {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
  </div>;
}
