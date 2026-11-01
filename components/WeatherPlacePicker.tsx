"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Crosshair, MagnifyingGlass, MapPin } from "@phosphor-icons/react";
import { MIN_PLACE_QUERY, parsePlaces, placeSearchUrl, type PlaceChoice } from "@/lib/place-search";
import { weatherPlace, type WeatherPlace } from "@/lib/weather";
import { currentWeatherPlace, loadWeatherConfig } from "@/lib/weather-client";
import { createClient } from "@/lib/supabase/client";

// For /preview, where nobody is signed in to search with.
const PREVIEW_PLACES: PlaceChoice[] = [
  { id: "p-mel", name: "Melbourne", detail: "Victoria, Australia", latitude: -37.81, longitude: 144.96, country: "AU", timeZone: "Australia/Melbourne" },
  { id: "p-akl", name: "Auckland", detail: "Auckland, New Zealand", latitude: -36.85, longitude: 174.76, country: "NZ", timeZone: "Pacific/Auckland" },
  { id: "p-syd", name: "Sydney", detail: "New South Wales, Australia", latitude: -33.87, longitude: 151.21, country: "AU", timeZone: "Australia/Sydney" },
  { id: "p-mum", name: "Mumbai", detail: "Maharashtra, India", latitude: 19.08, longitude: 72.88, country: "IN", timeZone: "Asia/Kolkata" },
  { id: "p-col", name: "Colombo", detail: "Western Province, Sri Lanka", latitude: 6.93, longitude: 79.85, country: "LK", timeZone: "Asia/Colombo" },
  { id: "p-lon", name: "London", detail: "England, United Kingdom", latitude: 51.51, longitude: -0.13, country: "GB", timeZone: "Europe/London" },
];

/**
 * Where the weather is for: a town or city by name, or wherever you are right
 * now. Only an explicitly selected city is saved with the account.
 */
export default function WeatherPlacePicker({
  chosen,
  previewMode = false,
  onSaved,
  onCancel,
}: {
  /** Whether a place is already chosen, to offer going back to automatic. */
  chosen: boolean;
  previewMode?: boolean;
  onSaved: (place: WeatherPlace | null, automatic?: boolean) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceChoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Searches as you type, a moment after you stop.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_PLACE_QUERY) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (previewMode) {
        setResults(PREVIEW_PLACES.filter((place) => place.name.toLowerCase().startsWith(q.toLowerCase())));
        return;
      }
      setSearching(true);
      try {
        const config = await loadWeatherConfig();
        if (!config) {
          setMessage("Place search isn't available right now. Try using your current location.");
          return;
        }
        const response = await fetch(placeSearchUrl(q, { apiKey: config.key, near: config.near, lang: config.lang }), {
          signal: controller.signal,
        });
        const places = response.ok ? parsePlaces(await response.json()) : [];
        setResults(places);
        setMessage(places.length ? "" : "No town or city by that name. Try another spelling.");
      } catch {
        if (!controller.signal.aborted) setMessage("Couldn't search just now. Try again.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, previewMode]);

  const save = async (place: WeatherPlace | null, automatic = false) => {
    setBusy(true);
    setMessage("");
    try {
      if (!previewMode) {
        const { error } = await createClient().auth.updateUser({ data: { weather_place: automatic ? null : place, weather_location_mode: automatic || !place ? "automatic" : "chosen" } });
        if (error) throw error;
      }
      onSaved(place, automatic || !place);
    } catch {
      setMessage("Couldn't save that place. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const choose = (place: PlaceChoice) => {
    const clean = weatherPlace(place);
    if (clean) void save(clean);
  };

  const useCurrentLocation = async () => {
    setBusy(true);
    setMessage("");
    try {
      const place = previewMode ? PREVIEW_PLACES[1] : await currentWeatherPlace(true);
      if (!place) throw new Error("unavailable");
      await save(place, true);
    } catch (error) {
      setMessage(
        (error as { code?: number }).code === 1
          ? "Location is blocked. Allow location in your browser settings, or search for your city."
          : "Couldn't find your location. Try again or search for your city."
      );
    } finally { setBusy(false); }
  };

  return (
    <div className="px-5 py-4">
      <h3 className="text-sm font-semibold">Weather for</h3>
      <label className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/30">
        <MagnifyingGlass size={16} className="shrink-0 text-[var(--muted)]" aria-hidden />
        <span className="sr-only">Search for a town or city</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            if (next.trim().length < MIN_PLACE_QUERY) {
              setResults([]);
              setMessage("");
            }
          }}
          placeholder="Search for a town or city"
          aria-controls={listId}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none focus-visible:outline-none"
        />
        {searching && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-400/40 border-t-sky-500" aria-hidden />}
      </label>

      <ul id={listId} className="mt-2 space-y-1" aria-label="Places">
        {results.map((place) => (
          <li key={place.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => choose(place)}
              className="flex w-full min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sky-500/10 disabled:opacity-60"
            >
              <MapPin size={16} className="shrink-0 text-sky-500" aria-hidden />
              <span className="min-w-0">
                <span className="block font-medium">{place.name}</span>
                {place.detail && <span className="block truncate text-xs text-[var(--muted)]">{place.detail}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={busy}
        onClick={useCurrentLocation}
        className="mt-2 flex w-full min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-sky-700 hover:bg-sky-500/10 disabled:opacity-60 dark:text-sky-300"
      >
        <Crosshair size={16} aria-hidden />
        Automatically follow my location
      </button>
      {chosen && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(null)}
          className="flex w-full min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-border)] disabled:opacity-60"
        >
          Return to automatic location
        </button>
      )}

      {message && <p role="status" className="mt-2 text-xs text-[var(--muted)]">{message}</p>}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--surface-border)] pt-3">
        <p className="text-[11px] leading-snug text-[var(--muted)]">Automatic follows this device. A city you choose stays fixed.</p>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium hover:bg-[var(--surface-border)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
