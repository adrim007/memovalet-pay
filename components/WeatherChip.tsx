"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CaretDown, Cloud, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, MapPin, Moon, Sun, X } from "@phosphor-icons/react";
import type { ConditionKind, WeatherCondition, WeatherPlace, WeatherSummary } from "@/lib/weather";
import { currentWeatherPlace } from "@/lib/weather-client";
import WeatherPlacePicker from "@/components/WeatherPlacePicker";

const ICONS: Record<ConditionKind, { day: typeof Sun; night: typeof Sun; tone: string }> = {
  clear: { day: Sun, night: Moon, tone: "text-amber-500" },
  fair: { day: CloudSun, night: CloudMoon, tone: "text-amber-500" },
  partly: { day: CloudSun, night: CloudMoon, tone: "text-slate-400" },
  cloudy: { day: Cloud, night: Cloud, tone: "text-slate-400" },
  fog: { day: CloudFog, night: CloudFog, tone: "text-slate-400" },
  rain: { day: CloudRain, night: CloudRain, tone: "text-sky-500" },
  sleet: { day: CloudRain, night: CloudRain, tone: "text-sky-400" },
  snow: { day: CloudSnow, night: CloudSnow, tone: "text-sky-300" },
  thunder: { day: CloudLightning, night: CloudLightning, tone: "text-violet-500" },
};

// Example weather for /preview, where there's no visitor location.
const PREVIEW_WEATHER: WeatherSummary = {
  city: "Melbourne",
  unit: "C",
  temperature: 14.2,
  condition: { kind: "partly", label: "Partly cloudy", night: false },
  days: [
    { date: "preview-0", label: "Today", high: 17, low: 9, condition: { kind: "partly", label: "Partly cloudy", night: false } },
    { date: "preview-1", label: "Wed", high: 19, low: 10, condition: { kind: "clear", label: "Sunny", night: false } },
    { date: "preview-2", label: "Thu", high: 16, low: 11, condition: { kind: "rain", label: "Light rain", night: false } },
    { date: "preview-3", label: "Fri", high: 13, low: 8, condition: { kind: "rain", label: "Showers", night: false } },
    { date: "preview-4", label: "Sat", high: 18, low: 9, condition: { kind: "fair", label: "Mostly sunny", night: false } },
  ],
};

const temperatureText = (value: number) => value.toFixed(1);

function ConditionIcon({ condition, size }: { condition: WeatherCondition | null; size: number }) {
  const icon = condition ? ICONS[condition.kind] : ICONS.cloudy;
  const Glyph = condition?.night ? icon.night : icon.day;
  return <Glyph size={size} weight="duotone" className={`shrink-0 ${icon.tone}`} aria-hidden />;
}

// The temperature and sky where you are, on the greeting's subtitle line. Tap for the week.
export default function WeatherChip({ previewMode = false }: { previewMode?: boolean }) {
  const [loaded, setLoaded] = useState<WeatherSummary | null>(null);
  // Keep device, connection estimate, and fixed city visibly distinct.
  const [source, setSource] = useState<"chosen" | "connection" | "device">("connection");
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [previewPlace, setPreviewPlace] = useState<WeatherPlace | null>(null);
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const forecastId = useId();

  const load = useCallback(async (devicePlace?: WeatherPlace, requestPermission = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const signal = controller.signal;
    setLocating(true);
    setLocationMessage("");
    try {
      let place = devicePlace;
      let data;
      if (!place) {
        const response = await fetch("/api/weather", { signal, cache: "no-store" });
        data = response.ok ? await response.json() : null;
        if (signal.aborted) return;
        if (data?.source !== "chosen" || requestPermission) {
          try { place = await currentWeatherPlace(requestPermission) ?? undefined; }
          catch {
            if (requestPermission) setLocationMessage("Allow location in your browser settings, or choose your city below.");
          }
        }
      }
      if (signal.aborted) return;
      if (place) {
        const response = await fetch("/api/weather", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(place), signal, cache: "no-store",
        });
        data = response.ok ? await response.json() : null;
      }
      if (signal.aborted) return;
      // Clear previous weather on failure, so a previous city never looks current.
      setLoaded(data?.weather ?? null);
      setSource(data?.source === "chosen" ? "chosen" : data?.source === "device" ? "device" : "connection");
    } catch {
      if (!signal.aborted) { setLoaded(null); setLocationMessage("Weather is unavailable. Please try again."); }
    } finally { if (!signal.aborted) setLocating(false); }
  }, []);

  useEffect(() => {
    if (previewMode) return;
    const initial = setTimeout(() => void load(), 0);
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = setInterval(refresh, 10 * 60 * 1000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      requestRef.current?.abort();
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [previewMode, load]);

  // Clicking anywhere else, or Esc, closes the forecast.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const weather = previewMode
    ? { ...PREVIEW_WEATHER, city: previewPlace?.name ?? PREVIEW_WEATHER.city }
    : loaded;
  if (!weather) return (
    <div className="relative">
      <button type="button" onClick={() => setChoosing((value) => !value)}
        className="min-h-11 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
        {locating ? "Finding local weather…" : "Set weather location"}
      </button>
      {choosing && <div className="fixed inset-x-4 bottom-4 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-80">
        <WeatherPlacePicker chosen={source === "chosen"} onCancel={() => setChoosing(false)}
          onSaved={(place, automatic) => { setChoosing(false); void load(automatic && place ? place : undefined); }} />
      </div>}
      {locationMessage && <p role="status" className="mt-1 text-xs text-[var(--muted)]">{locationMessage}</p>}
    </div>
  );
  const chosen = previewMode ? Boolean(previewPlace) : source === "chosen";

  const lowest = Math.min(...weather.days.map((day) => day.low));
  const span = Math.max(Math.max(...weather.days.map((day) => day.high)) - lowest, 1);
  const place = ` in ${weather.city}`;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          // Open towards whichever side has room: the chip sits on the right
          // beside the greeting, or wraps under it on a phone.
          const rect = wrapperRef.current?.getBoundingClientRect();
          if (rect) setAlignRight(rect.right - Math.min(360, window.innerWidth - 32) >= 16);
          setOpen((current) => !current);
          setChoosing(false);
        }}
        aria-expanded={open}
        aria-controls={forecastId}
        aria-label={`${temperatureText(weather.temperature)}°${weather.unit}, ${weather.condition?.label ?? "weather"}${place}. ${open ? "Hide" : "Show"} the forecast`}
        className="inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm shadow-sm transition-colors hover:border-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
      >
        <ConditionIcon condition={weather.condition} size={26} />
        <span className="text-lg font-semibold tabular-nums text-[var(--foreground)]">{temperatureText(weather.temperature)}°{weather.unit}</span>
        <span className="h-5 border-l border-[var(--surface-border)]" aria-hidden />
        <span className="inline-flex min-w-0 items-center gap-1 text-[var(--muted)]">
          <MapPin size={14} className="shrink-0" aria-hidden />
          <span className="max-w-[10rem] truncate">{weather.city}</span>
        </span>
        <CaretDown size={14} aria-hidden className={`shrink-0 text-[var(--muted)] ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id={forecastId}
          role="region"
          aria-label={`Weather forecast${place}`}
          className={`fixed inset-x-4 bottom-4 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--foreground)] shadow-xl shadow-black/15 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-3 sm:w-[360px] ${
            alignRight ? "sm:right-0" : "sm:left-0"
          }`}
        >
          <div className="border-b border-[var(--surface-border)] bg-sky-500/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                <MapPin size={16} className="shrink-0 text-[var(--muted)]" aria-hidden />
                <span className="[overflow-wrap:anywhere]">{weather.city}</span>
              </h2>
              <button type="button" aria-label="Close weather forecast" title="Close weather forecast"
                onClick={() => { setOpen(false); setChoosing(false); triggerRef.current?.focus(); }}
                className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-border)] focus-visible:outline-2 focus-visible:outline-sky-500">
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-[var(--muted)]">Current forecast</p>
                <p className="mt-1 flex items-start gap-1 font-semibold tabular-nums">
                  <span className="text-5xl leading-none">{temperatureText(weather.temperature)}°</span>
                  <span className="pt-1 text-lg text-[var(--muted)]">{weather.unit}</span>
                </p>
                {weather.condition && <p className="mt-2 text-sm text-[var(--muted)]">{weather.condition.label}</p>}
              </div>
              <ConditionIcon condition={weather.condition} size={72} />
            </div>
          </div>

          {choosing ? (
            <WeatherPlacePicker
              chosen={chosen}
              previewMode={previewMode}
              onCancel={() => setChoosing(false)}
              onSaved={(place, automatic) => {
                setChoosing(false);
                if (previewMode) setPreviewPlace(place);
                else void load(automatic && place ? place : undefined);
              }}
            />
          ) : (
          <>
          <div className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
            <h3 className="font-semibold text-[var(--foreground)]">{weather.days.length}-day forecast</h3>
            <span>Low / High (°{weather.unit})</span>
          </div>
          <ul className="divide-y divide-[var(--surface-border)]" aria-label="Forecast">
            {weather.days.map((day) => (
              <li key={day.date} className="grid grid-cols-[minmax(0,1fr)_1.5rem_2.25rem_minmax(1rem,3rem)_2.25rem] items-center gap-2 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{day.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted)]">{day.condition?.label}</span>
                </span>
                <ConditionIcon condition={day.condition} size={23} />
                <span className="text-right tabular-nums text-[var(--muted)]"><span className="sr-only">Low </span>{temperatureText(day.low)}°</span>
                {/* Where the day's low and high sit within the whole week's range. */}
                <span className="relative h-1.5 overflow-hidden rounded-full bg-[var(--background)]" aria-hidden>
                  <span
                    className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-400 to-amber-400"
                    style={{
                      left: `${((day.low - lowest) / span) * 100}%`,
                      width: `${Math.max(((day.high - day.low) / span) * 100, 6)}%`,
                    }}
                  />
                </span>
                <span className="text-right font-semibold tabular-nums"><span className="sr-only">High </span>{temperatureText(day.high)}°</span>
              </li>
            ))}
          </ul>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--surface-border)] px-5 py-2">
            <p className="text-xs text-[var(--muted)]">
              {chosen ? "Fixed city · stays here when you travel." : source === "device" ? "Automatic · follows your location." : "Automatic · approximate location from your connection."}
            </p>
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
            >
              {chosen ? "Change" : "Change location"}
            </button>
          </div>
          {!chosen && !previewMode && source !== "device" && (
            <button type="button" disabled={locating} onClick={() => void load(undefined, true)}
              className="mx-5 mb-3 min-h-11 rounded-lg px-3 text-sm font-semibold text-sky-700 hover:bg-sky-500/10 disabled:opacity-60 dark:text-sky-300">
              {locating ? "Finding your location…" : "Use my device location"}
            </button>
          )}
          {locationMessage && <p role="status" className="px-5 pb-3 text-xs text-[var(--muted)]">{locationMessage}</p>}
          <p className="border-t border-[var(--surface-border)] px-5 py-3 text-[11px] leading-relaxed text-[var(--muted)]">
            Forecast by{" "}
            <a href="https://www.met.no/en" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
              MET Norway
            </a>{" "}
            (
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              CC BY 4.0
            </a>
            ).
          </p>
          </>
          )}
        </div>
      )}
    </div>
  );
}
