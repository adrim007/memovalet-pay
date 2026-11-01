// MemoValet Pay only ever talks to the PayPal sandbox (test money). Any sign of a live
// PayPal address or live mode stops it, so the demo can never move real money.

export const SANDBOX_API = "https://api-m.sandbox.paypal.com";

export type PayPalConfig = { apiBase: string; clientId: string; clientSecret: string };

export class SandboxOnlyError extends Error {}

export function paypalConfig(env: Record<string, string | undefined> = process.env): PayPalConfig {
  const apiBase = (env.PAYPAL_API_BASE || SANDBOX_API).replace(/\/+$/, "");
  const mode = (env.PAYPAL_ENV || "sandbox").toLowerCase();
  if (mode !== "sandbox" || apiBase !== SANDBOX_API) {
    throw new SandboxOnlyError(
      `MemoValet Pay runs on the PayPal sandbox only. Set PAYPAL_ENV=sandbox and PAYPAL_API_BASE=${SANDBOX_API} (found ${mode}, ${apiBase}).`);
  }
  const clientId = env.PAYPAL_CLIENT_ID?.trim() || "";
  const clientSecret = env.PAYPAL_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) {
    throw new Error("Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET from a PayPal sandbox app to .env.local (see .env.example).");
  }
  return { apiBase, clientId, clientSecret };
}
