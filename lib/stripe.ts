import Stripe from "stripe";

// Server-only. Returns null when Stripe isn't configured so every caller can
// degrade honestly ("payments not set up yet") instead of crashing.
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
