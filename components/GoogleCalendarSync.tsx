"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleCalendarIcon } from "@/components/marketing/BrandIcons";
import type { Snapshot, SyncKind } from "@/lib/google/calendar-sync-model";

type Config = { calendar_id: string; calendar_name: string; time_zone: string; kinds: SyncKind[]; enabled: boolean; last_synced_at: string | null; last_error: string | null };
type Issue = { kind: SyncKind; source_id: string; issue: string; base: { title: string } | null; conflict: { local: Snapshot | null; remote: Snapshot | null } | null };
type Status = { available: boolean; config: Config | null; issues: Issue[]; calendars?: { id: string; name: string; timeZone: string }[] };
const OPTIONS: { kind: SyncKind; label: string }[] = [
  { kind: "commitment", label: "Personal tasks" }, { kind: "project", label: "Project deadlines" },
  { kind: "call", label: "Scheduled calls" }, { kind: "action_item", label: "Meeting tasks" }, { kind: "assignment", label: "Tasks I assign" },
];
// Calendar setup requests calendar permissions only. Incremental consent
// preserves permissions the customer previously gave other Google features.
const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly";
const DEFAULT_KINDS: SyncKind[] = ["commitment", "project", "call"];
function describeVersion(value: Snapshot | null) {
  if (!value) return "No scheduled event";
  return `${value.title}: ${value.at ? new Date(value.at).toLocaleString() : value.date}`;
}

export default function GoogleCalendarSync({ preview = false }: { preview?: boolean }) {
  const [status, setStatus] = useState<Status | null>(preview ? { available: true, config: null, issues: [], calendars: [{ id: "preview", name: "My calendar", timeZone: "Australia/Melbourne" }] } : null);
  const [calendarId, setCalendarId] = useState(preview ? "preview" : "");
  const [kinds, setKinds] = useState<SyncKind[]>(DEFAULT_KINDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (calendars = false, signal?: AbortSignal) => {
    if (preview) return;
    const response = await fetch(`/api/calendar/google${calendars ? "?calendars=1" : ""}`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Google Calendar could not be loaded.");
    setStatus(previous => ({ ...data, calendars: data.calendars || previous?.calendars }));
    if (data.config) { setCalendarId(data.config.calendar_id); setKinds(data.config.kinds); }
    else if (data.calendars?.length) setCalendarId(data.calendars[0].id);
  }, [preview]);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    void fetch("/api/calendar/google", { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Google Calendar could not be loaded.");
      if (controller.signal.aborted) return;
      setStatus(data);
      if (data.config) { setCalendarId(data.config.calendar_id); setKinds(data.config.kinds); }
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Google Calendar could not be loaded."); });
    return () => controller.abort();
  }, [preview]);

  async function act(body: Record<string, unknown>) {
    if (preview) { setMessage("Preview only. No calendar is connected or changed."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/calendar/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please retry this calendar action.");
      await load();
      setMessage(data.paused ? "Sync is paused. Existing calendar events remain." : data.configured ? "Connected. Use Sync now for the first update." : data.result?.issues ? "Some items need your review below." : data.result?.more ? "This pass is saved. More items will be checked in the next pass." : "Calendar check completed.");
      window.dispatchEvent(new Event("memovalet:calendar-changed"));
    } catch (error) { setError(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function choose() {
    setBusy(true); setError("");
    try { await load(true); } catch (error) { setError(error instanceof Error ? error.message : "Could not load calendars."); }
    finally { setBusy(false); }
  }
  async function connect() {
    if (preview) { setMessage("Preview only. No Google permissions are requested."); return; }
    setBusy(true); setError("");
    try {
      const db = createClient();
      const { data: { user }, error } = await db.auth.getUser();
      if (error || !user) throw new Error("Sign in again to connect your calendar.");
      const options = { redirectTo: `${window.location.origin}/auth/callback?connect=google&next=${encodeURIComponent("/calendar?sync=1")}`, scopes: SCOPES, queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" } };
      const linked = user.identities?.some(identity => identity.provider === "google");
      const result = linked ? await db.auth.signInWithOAuth({ provider: "google", options: { ...options, queryParams: { ...options.queryParams, login_hint: user.identities?.find(identity => identity.provider === "google")?.identity_data?.email || "" } } }) : await db.auth.linkIdentity({ provider: "google", options });
      if (result.error) throw new Error("Google could not be connected to this account. Try connecting Google in Settings first.");
    } catch (error) { setError(error instanceof Error ? error.message : "Google could not be connected."); setBusy(false); }
  }

  if (!status?.available) return error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : null;
  const config = status.config;
  const button = "rounded-lg border border-[var(--surface-border)] px-3 py-2 text-xs font-semibold transition hover:border-indigo-400 disabled:opacity-50";
  return <section aria-label="Direct Google Calendar connection" aria-busy={busy} className="mt-6 rounded-2xl border border-indigo-300/50 bg-indigo-500/[0.04] p-4">
    <div className="flex items-center gap-3"><GoogleCalendarIcon className="h-6 w-6 shrink-0" /><div><h3 className="text-sm font-bold">Google Calendar connection</h3><p className="mt-0.5 text-xs text-[var(--muted)]">Keep dates and titles in sync in both calendars.</p></div></div>
    <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Choose what to share. Only events created by this connection sync back. Deleting one in Google clears its scheduled date here and keeps your work.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button className={button} disabled={busy} onClick={connect}>{config ? "Renew Google access" : "Connect Google"}</button>
      <button className={button} disabled={busy} onClick={choose}>Choose calendar</button>
    </div>
    {config && <p className="mt-3 text-xs font-semibold">{config.calendar_name} · {config.enabled ? "Sync enabled" : "Paused"}</p>}
    {status.calendars && <div className="mt-4 space-y-3">
      <label className="block text-xs font-semibold">Destination calendar
        <select aria-label="Destination calendar" disabled={busy || !!config} value={calendarId} onChange={event => setCalendarId(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5 text-sm">
          {!status.calendars.length && <option value="">No writable calendars found</option>}
          {status.calendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
        </select>
      </label>
      <fieldset disabled={busy}><legend className="mb-2 text-xs font-semibold">Include my work</legend><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{OPTIONS.map(option => <label key={option.kind} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={kinds.includes(option.kind)} onChange={event => setKinds(current => event.target.checked ? [...current, option.kind] : current.filter(kind => kind !== option.kind))} />{option.label}</label>)}</div></fieldset>
      <p className="text-xs leading-5 text-[var(--muted)]">Meeting tasks and tasks you assign currently sync dates only. Unchecking a category stops its updates and keeps existing events.</p>
      <button disabled={busy || !calendarId || !kinds.length} className={`${button} bg-indigo-600 text-white`} onClick={() => act({ action: "configure", calendarId, kinds, timeZone: config?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone })}>{config ? "Save and resume" : "Enable sync"}</button>
    </div>}
    {config && <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={busy || !config.enabled} onClick={() => act({ action: "sync" })}>Sync now</button><button className={button} disabled={busy || !config.enabled} onClick={() => act({ action: "pause" })}>Pause sync</button></div>}
    {config?.last_synced_at && <p className="mt-3 text-xs text-[var(--muted)]">Last check: {new Date(config.last_synced_at).toLocaleString()}</p>}
    {(error || config?.last_error) && <p role="alert" className="mt-3 text-xs leading-5 text-red-600">{error || config?.last_error}</p>}
    {message && <p role="status" className="mt-3 text-xs leading-5 text-indigo-700 dark:text-indigo-300">{message}</p>}
    {status.issues.length > 0 && <ul aria-label="Calendar items needing review" className="mt-4 space-y-3">{status.issues.map(issue => <li key={`${issue.kind}:${issue.source_id}`} className="rounded-xl border border-amber-300/50 bg-amber-400/10 p-3">
      <p className="text-xs font-bold">{issue.base?.title || "Calendar item"}</p><p className="mt-1 text-xs leading-5">{issue.issue}</p>
      {issue.conflict && <><p className="mt-2 break-words text-xs leading-5"><strong>MemoValet:</strong> {describeVersion(issue.conflict.local)}</p><p className="break-words text-xs leading-5"><strong>Google:</strong> {describeVersion(issue.conflict.remote)}</p><div className="mt-2 flex flex-wrap gap-2">
        <button className={button} disabled={busy || !config?.enabled} onClick={() => act({ action: "resolve", kind: issue.kind, sourceId: issue.source_id, use: "memovalet", expected: issue.conflict })}>Keep MemoValet version</button>
        <button className={button} disabled={busy || !config?.enabled} onClick={() => act({ action: "resolve", kind: issue.kind, sourceId: issue.source_id, use: "google", expected: issue.conflict })}>Keep Google version</button>
      </div></>}
    </li>)}</ul>}
    <p className="mt-3 text-xs leading-5 text-[var(--muted)]">If you already subscribed to the MemoValet calendar link in Google, hide or remove that subscription to avoid seeing both copies.</p>
  </section>;
}
