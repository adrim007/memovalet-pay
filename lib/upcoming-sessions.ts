import type { createClient } from "@/lib/supabase/server";
import type { UpcomingCalendarEvent } from "@/lib/types";

/** Read the same scheduled calls Calendar uses, with the signed-in RLS client. */
export async function getUpcomingMemoValetSessions(
  supabase: Awaited<ReturnType<typeof createClient>>, userId: string, now = new Date(),
): Promise<{ events: UpcomingCalendarEvent[]; incomplete: boolean }> {
  const result = await supabase.from("live_sessions")
    .select("id,title,scheduled_start,duration_minutes")
    .eq("created_by", userId).eq("status", "active")
    .gte("scheduled_start", now.toISOString())
    .lte("scheduled_start", new Date(now.getTime() + 7 * 86400000).toISOString())
    .order("scheduled_start").limit(101);
  if (result.error) throw new Error("Couldn't load scheduled MemoValet meetings.");
  const rows = result.data ?? [];
  const events: UpcomingCalendarEvent[] = rows.slice(0, 100).flatMap(row => {
    const start = Date.parse(row.scheduled_start);
    if (!Number.isFinite(start)) return [];
    const minutes = Number(row.duration_minutes);
    return [{
      id: `memovalet:${row.id}`, title: row.title || "MemoValet meeting",
      start: new Date(start).toISOString(),
      end: Number.isFinite(minutes) && minutes > 0 ? new Date(start + minutes * 60000).toISOString() : null,
      meetLink: `/live/${encodeURIComponent(row.id)}`, attendees: [], source: "manual",
    }];
  });
  return { events, incomplete: rows.length > 100 };
}

