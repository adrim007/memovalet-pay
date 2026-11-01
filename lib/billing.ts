import "server-only";
import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import { billingAmount, billingPriceKey, hasBillingAccess, type BillingInterval, type BillingPlan } from "@/lib/billing-plans";

export type BillingAccount = {
  user_id: string; customer_id: string | null; subscription_id: string | null;
  status: string; access_until: string | null; trial_ends_at: string | null;
  trial_used: boolean; cancel_at_period_end: boolean; plan: string | null; seats?: number;
};
export function billingReady(): boolean {
  return process.env.BILLING_ENABLED === "true" && process.env.BILLING_ENTITLEMENTS_VERIFIED === "true" && !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_BILLING_WEBHOOK_SECRET &&
    ["member", "business"].every(plan => ["month", "year"].every(interval => !!process.env[billingPriceKey(plan as BillingPlan, interval as BillingInterval)]));
}
export function billingOrigin() {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://memovalet.com");
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Secure application URL required");
  return url.origin;
}
export async function billingAccount(userId: string): Promise<BillingAccount | null> {
  const { data, error } = await createServiceClient().from("billing_accounts").select("user_id,customer_id,subscription_id,status,access_until,trial_ends_at,trial_used,cancel_at_period_end,plan,seats").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Billing is temporarily unavailable");
  return data;
}
export async function withBillingLock<T>(userId: string, action: () => Promise<T>): Promise<T> {
  const db = createServiceClient();
  const token = randomUUID();
  const { data, error } = await db.rpc("claim_billing_lock", { p_user_id: userId, p_token: token });
  if (error || !data) throw new Error("Your billing request is already being processed. Please try again shortly.");
  try { return await action(); }
  finally { await db.from("billing_accounts").update({ lock_token: null, lock_until: null }).eq("user_id", userId).eq("lock_token", token); }
}
export async function saveBilling(userId: string, values: Record<string, unknown>) {
  const { error } = await createServiceClient().from("billing_accounts").update({ ...values, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) throw new Error("Your billing details could not be saved. Please retry.");
}
export async function billingStripePrice(stripe: Stripe, plan: BillingPlan, interval: BillingInterval) {
  const id = process.env[billingPriceKey(plan, interval)];
  if (!id) throw new Error("This plan is not available yet");
  const price = await stripe.prices.retrieve(id);
  if (!price.active || price.currency !== "usd" || price.unit_amount !== billingAmount(plan, interval) || price.recurring?.interval !== interval || price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed") {
    throw new Error("This plan is temporarily unavailable. Please contact support.");
  }
  return price;
}
// Fetch current Stripe state instead of applying possibly old webhook payloads.
// The per-account lock serialises webhook, checkout and return-page updates.
export async function refreshBilling(stripe: Stripe, account: BillingAccount) {
  if (!account.customer_id) return account;
  const subscriptions: Stripe.Subscription[] = [];
  for await (const subscription of stripe.subscriptions.list({ customer: account.customer_id, status: "all", limit: 100 })) {
    if (subscription.metadata.memovalet_user_id === account.user_id) subscriptions.push(subscription);
  }
  const current = subscriptions.filter(s => ["trialing", "active", "past_due", "unpaid", "paused", "incomplete"].includes(s.status)).sort((a,b) => b.created-a.created)[0] || subscriptions.sort((a,b) => b.created-a.created)[0];
  const trialUsed = account.trial_used || subscriptions.some(s => s.trial_start !== null);
  const item = current?.items.data.length === 1 ? current.items.data[0] : null;
  const verifiedPlan = item && (["member", "business"] as const).find(plan =>
    (["month", "year"] as const).some(interval => item.price?.id === process.env[billingPriceKey(plan, interval)] && item.price.currency === "usd" && item.price.unit_amount === billingAmount(plan, interval) && item.price.recurring?.interval === interval));
  const seats = item?.quantity;
  const validSeats = Number.isInteger(seats) && seats! >= 1 && seats! <= 50 && (verifiedPlan === "business" || seats === 1);
  const values = {
    subscription_id: current?.id || null,
    status: current?.status || "none",
    access_until: current ? new Date((current.status === "trialing" ? current.trial_end || 0 : Math.min(...current.items.data.map(i => i.current_period_end))) * 1000).toISOString() : null,
    trial_ends_at: current?.trial_end ? new Date(current.trial_end * 1000).toISOString() : null,
    trial_used: trialUsed,
    cancel_at_period_end: current?.cancel_at_period_end || false,
    plan: verifiedPlan && validSeats ? verifiedPlan : null,
    seats: validSeats ? seats! : 1,
  };
  await saveBilling(account.user_id, values);
  return { ...account, ...values };
}
export async function startCheckout(user: { id: string; email?: string }, plan: BillingPlan, interval: BillingInterval, seats = 1) {
  if (!Number.isInteger(seats) || seats < 1 || seats > 50 || (plan === "member" && seats !== 1)) throw new Error("Choose between 1 and 50 Business seats, or one Member seat.");
  if (!billingReady()) throw new Error("Card setup is not available yet. Please try again later.");
  const stripe = getStripe()!;
  return withBillingLock(user.id, async () => {
    const entitlement = await createServiceClient().rpc("billing_entitlement", { p_user: user.id });
    if (entitlement.error) throw new Error("Your current plan could not be checked.");
    if (entitlement.data?.plan === "business" && entitlement.data.payer_id !== user.id) throw new Error("Your Business seat is already paid for by your team. Ask the billing owner before starting a separate subscription.");
    let account = (await billingAccount(user.id))!;
    if (!account.customer_id) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { memovalet_user_id: user.id } }, { idempotencyKey: `memovalet-customer-${user.id}` });
      await saveBilling(user.id, { customer_id: customer.id });
      account = { ...account, customer_id: customer.id };
    }
    account = await refreshBilling(stripe, account);
    if (hasBillingAccess(account) || ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(account.status)) {
      throw new Error("You already have a subscription. Use Manage billing to update it.");
    }
    const price = await billingStripePrice(stripe, plan, interval);
    for await (const session of stripe.checkout.sessions.list({ customer: account.customer_id!, status: "open", limit: 100 })) {
      if (session.mode !== "subscription" || session.metadata?.memovalet_user_id !== user.id) continue;
      if (session.metadata.plan === plan && session.metadata.interval === interval && Number(session.metadata.seats || 1) === seats && session.url) return session.url;
      await stripe.checkout.sessions.expire(session.id);
    }
    const metadata = { memovalet_user_id: user.id, plan, interval, seats: String(seats) };
    const session = await stripe.checkout.sessions.create({
      customer: account.customer_id!, mode: "subscription", payment_method_types: ["card"], payment_method_collection: "always",
      client_reference_id: user.id, line_items: [{ price: price.id, quantity: seats }], metadata,
      subscription_data: { metadata, ...(account.trial_used ? {} : { trial_period_days: 14 }), trial_settings: { end_behavior: { missing_payment_method: "cancel" } } },
      success_url: `${billingOrigin()}/billing?checkout=complete`, cancel_url: `${billingOrigin()}/billing?checkout=cancelled`,
      custom_text: { submit: { message: account.trial_used ? "Your subscription starts with a payment today. You have already used your free trial." : "Your card will be charged after your 14 day free trial unless you cancel before the trial ends. Manage or cancel your subscription in Billing." } },
    });
    if (!session.url) throw new Error("Secure checkout could not be opened");
    return session.url;
  });
}
