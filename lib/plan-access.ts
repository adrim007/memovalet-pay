import "server-only";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";

export type PlanAccess = { plan: "free" | "member" | "business"; payer_id: string; allowance_seconds: number; used_seconds: number; seats: number };
export type PaidFeature = "hosting" | "projects" | "task_links" | "exports" | "shared_work" | "reports";
export function enforcePaidPlans() { return process.env.BILLING_ENTITLEMENTS_VERIFIED === "true"; }
export async function planAccess(userId: string): Promise<PlanAccess> {
  const { data, error } = await createServiceClient().rpc("billing_entitlement", { p_user: userId });
  if (error || !data) throw new Error("Your plan could not be checked. Please try again.");
  return data as PlanAccess;
}
export async function featureError(userId: string, feature: PaidFeature): Promise<string | null> {
  if (!enforcePaidPlans()) return null;
  const access = await planAccess(userId);
  const business = feature === "shared_work" || feature === "reports";
  if (access.plan === "free" || (business && access.plan !== "business")) return `This feature needs ${business ? "Business" : "Member or Business"}. Your saved work remains available on Free. Visit Billing to choose a plan.`;
  return null;
}
export async function reserveTranscription(sessionId: string, seconds: number): Promise<string | null> {
  if (!enforcePaidPlans()) return null;
  const id = randomUUID();
  const { data, error } = await createServiceClient().rpc("reserve_transcription", { p_session: sessionId, p_seconds: seconds, p_id: id });
  if (error) throw new Error("The transcription allowance could not be checked.");
  if (!data?.ok) throw new Error(data?.error || "The host has no transcription minutes remaining this month.");
  return id;
}
export async function refundTranscription(id: string | null) {
  if (!id) return;
  const { error } = await createServiceClient().rpc("refund_transcription", { p_id: id });
  if (error) console.error("Transcription allowance refund failed");
}
