import { randomUUID } from "node:crypto";
import { changedEventIds, eventPath, googleRequest, readGoogleEvent, syncAccessToken, writableCalendars, CalendarAccessError } from "./calendar-sync-api";
import { googleBody, remoteSnapshot, sameSnapshot, sourceChanges, sourceSnapshot, syncDecision, type GoogleEvent, type Snapshot, type SyncKind } from "./calendar-sync-model";
import { syncStore, type SyncConfig, type SyncItem } from "./calendar-sync-store";

type Resolution = { kind: SyncKind; sourceId: string; use: "memovalet" | "google"; expected: { local: Snapshot | null; remote: Snapshot | null } };
type Store = ReturnType<typeof syncStore>;
type Outcome = "checked" | "changed" | "issue" | "skipped";

// Google's change list is read from a little before the last complete pass,
// so a clock difference between us and Google can't hide an edit.
const FEED_OVERLAP_MS = 2 * 60_000;
// Items with a problem are looked at again after this long, in case it cleared.
const ISSUE_RETRY_MS = 15 * 60_000;

/**
 * One pass for one customer. Google's change list says which linked events
 * moved since the last complete pass, and the work rows say which changed in
 * MemoValet, so only those cost Google requests. Without a change list (the
 * first pass, or one Google has expired) every linked event is checked.
 */
export async function runCalendarSync(userId: string, resolution?: Resolution, options: { until?: number } = {}) {
  const store = syncStore(userId);
  const lease = await store.claim();
  if (!lease) throw new CalendarAccessError("A sync is already running. Please retry shortly.", 409);
  const config = lease.config;
  let checked = 0, changed = 0, issues = 0;
  const deadline = Math.min(Date.now() + 35000, options.until ?? Infinity);
  const passStart = new Date().toISOString();
  try {
    if (!config.enabled) throw new CalendarAccessError("Calendar sync is paused.", 409);
    const token = await syncAccessToken(userId);
    if (!resolution) await store.discover(config.kinds);
    const feed = !resolution && config.remote_seen_at
      ? await changedEventIds(token, config.calendar_id, new Date(Date.parse(config.remote_seen_at) - FEED_OVERLAP_MS).toISOString())
      : null;
    const mapped = await store.mappings(config.kinds, resolution);
    const rows = await store.sources(mapped);
    const due: SyncItem[] = [], settled: SyncItem[] = [];
    for (const item of mapped) {
      const local = sourceSnapshot(item.kind, rows.get(`${item.kind}:${item.source_id}`) ?? null, config.time_zone);
      if (!resolution && !item.pending_create && !item.base && !local) settled.push(item);
      else if (resolution || !feed || item.pending_create || feed.has(item.event_id) || !sameSnapshot(local, item.base)
        || (item.issue && Date.parse(item.checked_at) < Date.now() - ISSUE_RETRY_MS)) due.push(item);
    }
    if (settled.length) await store.retire(settled);
    if (due.length) {
      // Checked before any event is read: a lost permission must never look like every event was deleted.
      const calendars = await writableCalendars(token);
      if (!calendars.some(calendar => calendar.id === config.calendar_id)) throw new CalendarAccessError("The selected calendar is no longer writable. Restore its access before syncing.", 409);
    }
    due.sort((a, b) => Date.parse(a.checked_at) - Date.parse(b.checked_at));
    let done = 0;
    for (const item of due) {
      if (Date.now() > deadline) break;
      const outcome = await syncItem(store, config, token, userId, item, resolution);
      if (outcome === "changed") changed++;
      if (outcome === "issue") issues++;
      if (outcome !== "skipped") checked++;
      done++;
    }
    await store.release(lease.token, {
      last_synced_at: new Date().toISOString(), last_error: null,
      ...(resolution ? {} : { remote_seen_at: remoteSeenAt(due.slice(done), feed, passStart) }),
    });
    return { checked, changed, issues, more: done < due.length };
  } catch (error) {
    await store.release(lease.token, { last_error: error instanceof CalendarAccessError ? error.message : "Calendar sync paused after an error. Please retry." });
    throw error;
  }
}

/**
 * Where the next change list starts: the pass start, unless an item left for
 * later may hold a Google edit not yet applied, in which case from when that
 * item was last read. Items with no Google event yet hold nothing to miss.
 */
function remoteSeenAt(left: SyncItem[], feed: Set<string> | null, passStart: string) {
  let earliest = Date.parse(passStart);
  for (const item of left) {
    if (item.pending_create || !item.base || (feed && !feed.has(item.event_id))) continue;
    earliest = Math.min(earliest, Date.parse(item.checked_at));
  }
  return new Date(earliest).toISOString();
}

async function syncItem(store: Store, config: SyncConfig, token: string, userId: string, item: SyncItem, resolution?: Resolution): Promise<Outcome> {
  try {
    const row = await store.source(item.kind, item.source_id);
    const local = sourceSnapshot(item.kind, row, config.time_zone);
    let event = await readGoogleEvent(token, config.calendar_id, item.event_id);
    const key = `${item.kind}:${item.source_id}`;
    if (event && event.status !== "cancelled") {
      const marker = event.extendedProperties?.private;
      if (marker?.memovaletOwner !== userId || marker?.memovaletSource !== key) throw new Error("This event is not owned by this MemoValet connection. No changes were made.");
    }
    let remote = remoteSnapshot(event, item.kind, config.time_zone);
    let base = item.base;
    let wrote = false;
    if (item.pending_create && !remote && local && !base) {
      // Persist the intended first write before contacting Google. Retrying
      // always uses this same event ID, including a lost HTTP response.
      await store.save(item, { base: local });
      base = local;
      try {
        event = await googleRequest(token, eventPath(config.calendar_id) + "?sendUpdates=none", { method: "POST", body: { id: item.event_id, ...googleBody(local, userId, key, config.time_zone) } }) as GoogleEvent;
      } catch (error) {
        // Do not overwrite an insert collision. The next pass verifies
        // ownership and reconciles the actual remote event.
        if (error instanceof CalendarAccessError && error.status === 409) return "skipped";
        throw error;
      }
      if (!event) throw new Error("The Google event could not be created.");
      remote = remoteSnapshot(event, item.kind, config.time_zone);
      wrote = true;
    } else if (item.pending_create && !remote && local && base && !event) {
      // A retry after an uncertain insert: use the saved payload, not a
      // newer local edit, so the three-way comparison remains valid.
      try {
        event = await googleRequest(token, eventPath(config.calendar_id) + "?sendUpdates=none", { method: "POST", body: { id: item.event_id, ...googleBody(base, userId, key, config.time_zone) } }) as GoogleEvent;
      } catch (error) {
        if (error instanceof CalendarAccessError && error.status === 409) return "skipped";
        throw error;
      }
      if (!event) throw new Error("The Google event could not be created.");
      remote = remoteSnapshot(event, item.kind, config.time_zone);
      wrote = true;
    }
    const stale = resolution && (!sameSnapshot(resolution.expected.local, local) || !sameSnapshot(resolution.expected.remote, remote));
    const decision = stale ? "conflict" : resolution ? resolution.use === "google" ? "pull" : "push" : syncDecision(base, local, remote);
    if (decision === "conflict") {
      await store.save(item, { issue: "Changed in both calendars. Choose which version to keep.", conflict: { local, remote } });
      return "issue";
    }
    let next = local;
    if (decision === "pull" && !sameSnapshot(local, remote)) {
      if (!row || (!local && remote)) throw new Error("This work was completed or removed in MemoValet. Restore it before keeping Google's version.");
      await store.updateSource(item, row, sourceChanges(item.kind, remote, row));
      next = remote;
      wrote = true;
    }
    if (decision === "push" && !sameSnapshot(local, remote)) {
      if (remote) {
        if (!event?.etag) throw new Error("Google did not return an event version. Please retry.");
        const response = await googleRequest(token, eventPath(config.calendar_id, item.event_id) + "?sendUpdates=none", { method: local ? "PATCH" : "DELETE", etag: event.etag, ...(local ? { body: googleBody(local, userId, key, config.time_zone) } : {}) });
        if (response === null) throw new Error("The event changed while syncing. Please retry.");
        wrote = true;
      } else if (local) {
        // Google tombstones cannot be reused. Reserve a new ID, then let
        // the next pass insert it safely with the same recovery rules.
        await store.save(item, { event_id: randomUUID().replaceAll("-", ""), base: null, pending_create: true, issue: null, conflict: null });
        return wrote ? "changed" : "checked";
      }
    }
    await store.save(item, { base: next, pending_create: false, issue: null, conflict: null });
    return wrote ? "changed" : "checked";
  } catch (error) {
    // Authentication, quota and outages stop the pass. Data conflicts are
    // per item so one bad event does not prevent all other work syncing.
    if (error instanceof CalendarAccessError && ![409, 412].includes(error.status)) throw error;
    const message = error instanceof Error ? error.message : "This item could not sync. Please retry.";
    await store.save(item, { issue: message, conflict: null });
    return "issue";
  }
}

export type { SyncItem };
