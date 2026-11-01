import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { SOURCES, type Snapshot, type SourceRow, type SyncKind } from "./calendar-sync-model";

export type SyncConfig = { user_id: string; calendar_id: string; calendar_name: string; time_zone: string; kinds: SyncKind[]; enabled: boolean; last_synced_at: string | null; last_error: string | null; remote_seen_at: string | null };
export type SyncItem = { user_id: string; kind: SyncKind; source_id: string; event_id: string; base: Snapshot | null; pending_create: boolean; issue: string | null; checked_at: string };
const CONFIG_COLUMNS = "user_id,calendar_id,calendar_name,time_zone,kinds,enabled,last_synced_at,last_error,remote_seen_at";
const ITEM_COLUMNS = "user_id,kind,source_id,event_id,base,pending_create,issue,checked_at";
// IDs per `in` filter, which travels in the request URL.
const CHUNK = 150;
function chunks<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < values.length; start += CHUNK) result.push(values.slice(start, start + CHUNK));
  return result;
}
export function syncStore(userId: string) {
  const db = createServiceClient();
  const configQuery = () => db.from("google_calendar_sync").select(CONFIG_COLUMNS).eq("user_id", userId);
  const items = () => db.from("google_calendar_sync_items");
  return {
    async config(): Promise<SyncConfig | null> {
      const result = await configQuery().maybeSingle(); if (result.error) throw result.error; return result.data;
    },
    async issues() {
      const result = await items().select("kind,source_id,issue,base,conflict").eq("user_id", userId).not("issue", "is", null).limit(50);
      if (result.error) throw result.error; return result.data || [];
    },
    async claim() {
      const token = randomUUID();
      const result = await db.from("google_calendar_sync").update({ lock_token: token, locked_until: new Date(Date.now() + 180000).toISOString(), last_attempt_at: new Date().toISOString() }).eq("user_id", userId).lte("locked_until", new Date().toISOString()).select(CONFIG_COLUMNS).maybeSingle();
      if (result.error) throw result.error;
      return result.data ? { token, config: result.data as SyncConfig } : null;
    },
    async release(token: string, values: Record<string, unknown> = {}) {
      const result = await db.from("google_calendar_sync").update({ ...values, lock_token: null, locked_until: new Date(0).toISOString() }).eq("user_id", userId).eq("lock_token", token);
      if (result.error) throw result.error;
    },
    async create(config: Omit<SyncConfig, "last_synced_at" | "last_error" | "remote_seen_at">) {
      const result = await db.from("google_calendar_sync").insert(config);
      if (result.error) throw result.error;
    },
    async source(kind: SyncKind, id: string): Promise<SourceRow | null> {
      const spec = SOURCES[kind];
      const result = await db.from(spec.table).select(spec.columns).eq(spec.owner, userId).eq("id", id).maybeSingle();
      if (result.error) throw result.error; return result.data as unknown as SourceRow | null;
    },
    /** Every owned source row behind these mappings, keyed `kind:id`. Missing rows were deleted. */
    async sources(mapped: SyncItem[]): Promise<Map<string, SourceRow>> {
      const reads = [...new Set(mapped.map(item => item.kind))].flatMap(kind => {
        const spec = SOURCES[kind];
        return chunks(mapped.filter(item => item.kind === kind).map(item => item.source_id))
          .map(ids => db.from(spec.table).select(spec.columns).eq(spec.owner, userId).in("id", ids).then(result => ({ kind, result })));
      });
      const rows = new Map<string, SourceRow>();
      for (const { kind, result } of await Promise.all(reads)) {
        if (result.error) throw result.error;
        for (const row of (result.data || []) as unknown as SourceRow[]) rows.set(`${kind}:${row.id}`, row);
      }
      return rows;
    },
    /** Reserve an event ID for newly dated, open work. One statement in the database. */
    async discover(kinds: SyncKind[]) {
      const result = await db.rpc("reserve_calendar_sync_items", { p_user: userId, p_kinds: kinds });
      if (result.error) throw result.error;
    },
    async mappings(kinds: SyncKind[], target?: { kind: SyncKind; sourceId: string }): Promise<SyncItem[]> {
      const all: SyncItem[] = [];
      for (let offset = 0; ; offset += 1000) {
        let query = items().select(ITEM_COLUMNS).eq("user_id", userId).in("kind", kinds).order("kind").order("source_id").range(offset, offset + 999);
        if (target) query = query.eq("kind", target.kind).eq("source_id", target.sourceId);
        const result = await query; if (result.error) throw result.error;
        const page = (result.data || []) as SyncItem[];
        all.push(...page);
        if (page.length < 1000) return all;
      }
    },
    /** Forget mappings with nothing on either side: no live work and no Google event. */
    async retire(settled: SyncItem[]) {
      for (const kind of new Set(settled.map(item => item.kind))) {
        for (const ids of chunks(settled.filter(item => item.kind === kind).map(item => item.source_id))) {
          const result = await items().delete().eq("user_id", userId).eq("kind", kind).in("source_id", ids).is("base", null).eq("pending_create", false);
          if (result.error) throw result.error;
        }
      }
    },
    async save(item: SyncItem, values: Record<string, unknown>) {
      const result = await items().update({ ...values, checked_at: new Date().toISOString() }).eq("user_id", userId).eq("kind", item.kind).eq("source_id", item.source_id);
      if (result.error) throw result.error;
    },
    async updateSource(item: SyncItem, row: SourceRow, changes: Record<string, string | number | null>) {
      const spec = SOURCES[item.kind];
      let query = db.from(spec.table).update(changes).eq(spec.owner, userId).eq("id", item.source_id);
      // Compare every field read so a concurrent edit cannot be overwritten.
      for (const [key, value] of Object.entries(row)) if (key !== "id") query = value === null ? query.is(key, null) : query.eq(key, value);
      const result = await query.select("id");
      if (result.error) throw result.error;
      if (result.data?.length !== 1) throw new Error("This item changed in MemoValet while syncing. Please retry.");
    },
  };
}
