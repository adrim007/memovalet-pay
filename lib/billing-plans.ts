export const TRIAL_DAYS = 14;
export const BILLING_PLANS = {
  member: { name: "Member", monthly: 19, yearly: 190 },
  business: { name: "Business", monthly: 39, yearly: 390 },
} as const;
export type BillingPlan = keyof typeof BILLING_PLANS;
export type BillingInterval = "month" | "year";
export function billingSelection(plan: unknown, interval: unknown): { plan: BillingPlan; interval: BillingInterval } | null {
  return (plan === "member" || plan === "business") && (interval === "month" || interval === "year") ? { plan, interval } : null;
}
export function billingPriceKey(plan: BillingPlan, interval: BillingInterval) {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
}
export function billingAmount(plan: BillingPlan, interval: BillingInterval) {
  return BILLING_PLANS[plan][interval === "year" ? "yearly" : "monthly"] * 100;
}
export type BillingAccess = { status: string; access_until: string | null };
export function hasBillingAccess(record: BillingAccess | null, now = Date.now()): boolean {
  return !!record && (record.status === "active" || record.status === "trialing") && !!record.access_until && Date.parse(record.access_until) > now;
}
