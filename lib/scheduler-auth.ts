import { createHash, timingSafeEqual } from "node:crypto";
import type { createServiceClient } from "@/lib/supabase/service";

// Scheduled jobs prove who they are with a Bearer token in the Authorization
// header, never the URL, which ends up in logs. Vercel's scheduler sends
// CRON_SECRET; the Supabase scheduler (pg_cron) sends a short-lived signed
// timestamp instead, so no reusable secret sits in its request queue.

function bearer(request: Request): string | null {
  return request.headers.get("authorization")?.match(/^Bearer ([^ ]+)$/)?.[1] ?? null;
}

/** True when the request carries `secret`. Compared in constant time, so response timing gives nothing away. */
export function carriesSecret(request: Request, secret: string | undefined): boolean {
  const supplied = bearer(request);
  if (!secret || !supplied) return false;
  // Hashing gives both sides the same length, which timingSafeEqual needs.
  return timingSafeEqual(createHash("sha256").update(supplied).digest(), createHash("sha256").update(secret).digest());
}

/** Either scheduler. The signed timestamp is checked by the database (migration reminder_short_lived_auth). */
export async function fromScheduler(request: Request, secret: string | undefined, db: ReturnType<typeof createServiceClient>): Promise<boolean> {
  if (carriesSecret(request, secret)) return true;
  const supplied = bearer(request);
  if (!supplied || !/^\d{10}\.[a-f0-9]{64}$/.test(supplied)) return false;
  const checked = await db.rpc("verify_reminder_dispatch", { p_token: supplied });
  return !checked.error && checked.data === true;
}
