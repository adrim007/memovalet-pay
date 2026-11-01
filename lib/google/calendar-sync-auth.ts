import { createClient } from "@/lib/supabase/server";
import { CalendarAccessError } from "./calendar-sync-api";

export const calendarSyncAvailable = () => process.env.GOOGLE_CALENDAR_SYNC_ENABLED === "true";
export async function calendarSyncUser(request: Request) {
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) throw new CalendarAccessError("Please make this change from your MemoValet calendar.", 403);
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new CalendarAccessError("Sign in required.", 401);
  const assurance = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || !assurance.data) throw new CalendarAccessError("Your session could not be verified.", 503);
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") throw new CalendarAccessError("Complete two step verification first.", 401);
  return user;
}
