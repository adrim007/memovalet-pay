import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { buildCalendarFeed, feedEvents, FEED_TOKEN, type FeedRows } from "@/lib/calendar-feed";

// The calendar link's data. Calendar apps can't sign in, so the secret in the
// link is the key, and the service role does the reading. The service role
// skips row level security, so EVERY query below names its owner itself:
// a link only ever shows the person it belongs to.

const DAY = 24 * 60 * 60 * 1000;
// Three months back (so a slipped deadline stays visible) to two years ahead.
const window = () => {
  const now = Date.now();
  return { from: new Date(now - 90 * DAY), to: new Date(now + 730 * DAY) };
};
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function newFeedToken() {
  return randomBytes(32).toString("base64url");
}

/** The calendar file for a link, or null when the link isn't (or is no longer) anyone's. */
export async function calendarFeedFor(token: string, site: string): Promise<string | null> {
  if (!FEED_TOKEN.test(token)) return null;
  const db = createServiceClient();
  const { data: feed, error } = await db.from("calendar_feeds").select("user_id").eq("token", token).maybeSingle();
  if (error) throw error;
  if (!feed?.user_id) return null;
  const userId: string = feed.user_id;
  const { from, to } = window();

  const [commitments, projects, actionItems, sentTasks, calls] = await Promise.all([
    db.from("commitments").select("id,description,direction,person_name,due_date,due_at,priority")
      .eq("user_id", userId).in("status", ["pending", "overdue"])
      .gte("due_date", isoDate(from)).lte("due_date", isoDate(to)).limit(2000),
    db.from("projects").select("id,name,due_date,due_at")
      .eq("created_by", userId).eq("status", "active")
      .gte("due_date", isoDate(from)).lte("due_date", isoDate(to)).limit(1000),
    db.from("action_items").select("id,task,due_date,priority")
      .eq("user_id", userId).eq("status", "todo")
      .gte("due_date", isoDate(from)).lte("due_date", isoDate(to)).limit(2000),
    db.from("task_assignments").select("id,title,recipient_email,due_date,priority")
      .eq("created_by", userId).eq("status", "pending")
      .gte("due_date", isoDate(from)).lte("due_date", isoDate(to)).limit(2000),
    db.from("live_sessions").select("id,title,scheduled_start,duration_minutes")
      .eq("created_by", userId).eq("status", "active")
      .gte("scheduled_start", from.toISOString()).lte("scheduled_start", to.toISOString()).limit(1000),
  ]);
  // A calendar app keeps its last copy when a fetch fails, which is better
  // than a half-empty calendar, so any failure fails the whole thing.
  for (const result of [commitments, projects, actionItems, sentTasks, calls]) if (result.error) throw result.error;

  const rows: FeedRows = {
    commitments: commitments.data ?? [],
    projects: projects.data ?? [],
    actionItems: actionItems.data ?? [],
    sentTasks: sentTasks.data ?? [],
    calls: calls.data ?? [],
  };
  await db.from("calendar_feeds").update({ last_fetched_at: new Date().toISOString() }).eq("user_id", userId).then(() => undefined, () => undefined);
  return buildCalendarFeed(feedEvents(rows, site));
}

/** The signed-in person's link, if they have one. */
export async function feedTokenFor(userId: string): Promise<string | null> {
  const { data, error } = await createServiceClient().from("calendar_feeds").select("token").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.token ?? null;
}

/** Make a link, or a new one in place of the old (the old one stops working). */
export async function issueFeedToken(userId: string): Promise<string> {
  const token = newFeedToken();
  const { error } = await createServiceClient().from("calendar_feeds")
    .upsert({ user_id: userId, token, created_at: new Date().toISOString(), last_fetched_at: null }, { onConflict: "user_id" });
  if (error) throw error;
  return token;
}

/** Turn the link off: calendars subscribed to it stop updating. */
export async function removeFeedToken(userId: string): Promise<void> {
  const { error } = await createServiceClient().from("calendar_feeds").delete().eq("user_id", userId);
  if (error) throw error;
}
