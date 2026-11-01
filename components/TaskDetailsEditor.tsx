"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActionItemRecord } from "@/lib/types";
import { mapsUrl as buildMapsUrl, handleMapsClick } from "@/lib/maps";
import AddressInput from "@/components/AddressInput";

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface TaskDetailsEditorProps {
  item: ActionItemRecord;
  onUpdate: (patch: Partial<ActionItemRecord>) => void;
}

export default function TaskDetailsEditor({ item, onUpdate }: TaskDetailsEditorProps) {
  const [location, setLocation] = useState(item.location ?? "");
  const [reminderInput, setReminderInput] = useState(
    item.reminder_at ? toLocalInputValue(item.reminder_at) : ""
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const saveField = async (patch: Record<string, string | null>, confirmed: Partial<ActionItemRecord>) => {
    if (saveLock.current) return;
    saveLock.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(`/api/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("failed");
      onUpdate(confirmed);
    } catch {
      setError("Couldn't save that change. Your saved details have not changed. Please try again.");
      setLocation(item.location ?? "");
      setReminderInput(item.reminder_at ? toLocalInputValue(item.reminder_at) : "");
    } finally { saveLock.current = false; setSaving(false); }
  };

  // Takes the value directly when a suggestion is picked, before state catches up.
  const commitLocation = (value = location) => {
    const trimmed = value.trim();
    void saveField({ location: trimmed || null }, { location: trimmed || null });
  };

  const commitReminder = (value: string) => {
    setReminderInput(value);
    const iso = value ? new Date(value).toISOString() : null;
    void saveField({ reminderAt: iso }, { reminder_at: iso });
  };

  const handlePhotoSelect = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");

      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("task-photos")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("task-photos").getPublicUrl(path);
      await saveField({ photoUrl: data.publicUrl }, { photo_url: data.publicUrl });
    } catch {
      setError("Couldn't upload that photo.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    void saveField({ photoUrl: null }, { photo_url: null });
  };

  const mapsUrl = item.location ? buildMapsUrl(item.location) : null;

  return (
    <fieldset disabled={saving || uploading} className="mt-2.5 pt-3 border-t border-[var(--surface-border)] space-y-2.5">
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <AddressInput
          ariaLabel="Task location"
          placeholder="Add a location"
          value={location}
          onChange={setLocation}
          onBlur={() => commitLocation()}
          onCommit={commitLocation}
          className="w-full rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-1.5 text-xs outline-none focus:border-indigo-400"
        />
        {mapsUrl && (
          <a
            href={mapsUrl}
            onClick={handleMapsClick(item.location as string)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-indigo-500 dark:text-indigo-300 hover:underline shrink-0"
          >
            Open in Maps
          </a>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted)] w-16 shrink-0">Reminder</span>
        <input
          type="datetime-local"
          value={reminderInput}
          onChange={(e) => commitReminder(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--surface-border)] bg-transparent px-3 py-1.5 text-xs outline-none focus:border-indigo-400"
        />
      </div>

      <div className="flex items-center gap-2.5">
        <span className="text-xs text-[var(--muted)] w-16 shrink-0">Photo</span>
        {item.photo_url ? (
          <div className="flex items-center gap-2">
            <a href={item.photo_url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.photo_url}
                alt="Task attachment"
                className="h-10 w-10 rounded-lg object-cover border border-[var(--surface-border)]"
              />
            </a>
            <button
              type="button"
              onClick={removePhoto}
              className="text-xs text-red-500 dark:text-red-400 hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--surface-border)] hover:border-indigo-400/40 hover:bg-indigo-400/5 transition disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload photo"}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhotoSelect(file);
            e.target.value = "";
          }}
        />
      </div>
    </fieldset>
  );
}
