import { RoomServiceClient } from "livekit-server-sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { finishedSessions, longAbandonedSessions, type OpenSession } from "@/lib/stale-sessions";

/**
 * Closes calls nobody closed (see lib/stale-sessions).
 *
 * Run by the scheduler, and again whenever someone starts a new call, so the
 * list of what is live stays true without waiting for a nightly sweep.
 *
 * LiveKit is asked which rooms are actually occupied. If it cannot be reached,
 * only calls far too old to still be running are closed: a service hiccup must
 * never end a meeting that is happening.
 */
export async function sweepStaleSessions(): Promise<{ closed: number; checked: number; reachedLiveKit: boolean }> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("live_sessions")
    .select("id, created_at, scheduled_start")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error || !data?.length) return { closed: 0, checked: 0, reachedLiveKit: false };

  const open: OpenSession[] = data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    scheduledStart: row.scheduled_start,
  }));

  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  let liveRooms: string[] | null = null;
  if (url && key && secret) {
    try {
      const rooms = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret);
      liveRooms = (await rooms.listRooms()).map((room) => room.name);
    } catch (problem) {
      console.error("Could not ask LiveKit which calls are live", problem instanceof Error ? problem.name : "unknown");
    }
  }

  const now = Date.now();
  const finished = liveRooms
    ? finishedSessions({ open, liveRooms, now })
    : longAbandonedSessions({ open, now });
  if (!finished.length) return { closed: 0, checked: open.length, reachedLiveKit: liveRooms !== null };

  const closed = await service
    .from("live_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .in("id", finished)
    .eq("status", "active")
    .select("id");
  if (closed.error) {
    console.error("Could not close finished calls", closed.error.code);
    return { closed: 0, checked: open.length, reachedLiveKit: liveRooms !== null };
  }
  return { closed: closed.data?.length ?? 0, checked: open.length, reachedLiveKit: liveRooms !== null };
}
