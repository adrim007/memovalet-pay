import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { calendarSyncAvailable } from "@/lib/google/calendar-sync-auth";
import { runCalendarSync } from "@/lib/google/calendar-sync";
import { fromScheduler } from "@/lib/scheduler-auth";

export const maxDuration = 60;
// Each minute's run serves as many customers as fit, several at a time,
// longest-waiting first, and stops starting new ones well before the limit.
const BUDGET_MS = 45_000;
const START_CUTOFF_MS = 15_000;
const PARALLEL = 5;
const QUEUE = 60;

export async function GET(request: Request) {
  const db = createServiceClient();
  if (!(await fromScheduler(request, process.env.CRON_SECRET, db))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!calendarSyncAvailable()) return NextResponse.json({ enabled: false });
  const until = Date.now() + BUDGET_MS;
  const pending = await db.from("google_calendar_sync").select("user_id").eq("enabled", true).lte("locked_until", new Date().toISOString()).order("last_attempt_at").limit(QUEUE);
  if (pending.error) return NextResponse.json({ error: "Calendar queue is unavailable" }, { status: 503 });
  const queue = (pending.data || []).map(row => row.user_id as string);
  let next = 0, synced = 0, failed = 0;
  async function worker() {
    while (next < queue.length && Date.now() < until - START_CUTOFF_MS) {
      const userId = queue[next++];
      // One customer's failure is recorded on their connection and never stops the others.
      try { await runCalendarSync(userId, undefined, { until }); synced++; } catch { failed++; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));
  return NextResponse.json({ synced, failed, waiting: queue.length - next });
}
