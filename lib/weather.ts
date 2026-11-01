// The weather on the home page: roughly where the visitor is, and a short
// forecast for there.
//
// Where: automatically follows the device when location permission is granted,
// otherwise uses the request's approximate Vercel location. Only an explicitly
// chosen fixed city is saved to the account; device coordinates are not stored.
//
// Forecast: MET Norway (the Norwegian Meteorological Institute). No key, and the
// data is CC BY 4.0, which allows commercial use with credit. Their terms ask
// each app to name itself, credit them, send at most 4 decimal places and not
// re-ask before a forecast updates. Open-Meteo's free tier is non-commercial
// only, so it's no good for a paid product.

const FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
export const WEATHER_USER_AGENT = "MemoValet/1.0 https://memovalet.com";
const FORECAST_DAYS = 5;

export type TemperatureUnit = "C" | "F";
export type ConditionKind = "clear" | "fair" | "partly" | "cloudy" | "fog" | "rain" | "sleet" | "snow" | "thunder";

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  timeZone: string | null;
}

export interface WeatherCondition {
  kind: ConditionKind;
  label: string;
  night: boolean;
}

export interface WeatherDay {
  date: string; // YYYY-MM-DD where the visitor is
  label: string; // "Today", "Tonight", "Wed"
  high: number;
  low: number;
  condition: WeatherCondition | null;
}

export interface WeatherSummary {
  city: string;
  unit: TemperatureUnit;
  temperature: number;
  condition: WeatherCondition | null;
  days: WeatherDay[];
}

// Two decimal places is about a kilometre: close enough for weather, and
// everyone nearby shares one cached forecast.
const roughly = (value: number) => Math.round(value * 100) / 100;

export function weatherLocation(header: (name: string) => string | null): WeatherLocation | null {
  const rawLatitude = header("x-vercel-ip-latitude");
  const rawLongitude = header("x-vercel-ip-longitude");
  if (!rawLatitude || !rawLongitude) return null;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }

  let city: string | null;
  try {
    city = decodeURIComponent(header("x-vercel-ip-city") ?? "").trim().slice(0, 80) || null;
  } catch {
    city = null;
  }

  const timeZone = validTimeZone(header("x-vercel-ip-timezone"));

  const country = header("x-vercel-ip-country")?.trim().toUpperCase() || null;
  return { latitude: roughly(latitude), longitude: roughly(longitude), city, country, timeZone };
}

/**
 * A place someone picked for their weather, saved with their account
 * (user_metadata.weather_place). The connection's location is only a guess —
 * a suburb or two out, the wrong city behind a VPN or a work network — so
 * people can say where they actually are.
 */
export interface WeatherPlace {
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  timeZone: string | null;
}

function validTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

/** A place fit to save: checked, and rounded to about a kilometre before it is kept. */
export function weatherPlace(input: unknown): WeatherPlace | null {
  if (!input || typeof input !== "object") return null;
  const place = input as Record<string, unknown>;
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  if (
    typeof place.latitude !== "number" || typeof place.longitude !== "number" ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180
  ) {
    return null;
  }
  const name = typeof place.name === "string" ? place.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  const country =
    typeof place.country === "string" && /^[a-z]{2}$/i.test(place.country) ? place.country.toUpperCase() : null;
  return { name, latitude: roughly(latitude), longitude: roughly(longitude), country, timeZone: validTimeZone(place.timeZone) };
}

/** The place saved on an account, as a location for the forecast. */
export function savedWeatherLocation(metadata: unknown): WeatherLocation | null {
  const place = weatherPlace((metadata as { weather_place?: unknown } | null | undefined)?.weather_place);
  if (!place) return null;
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    city: place.name || null,
    country: place.country,
    timeZone: place.timeZone,
  };
}

// Places that use Fahrenheit.
const FAHRENHEIT = new Set(["US", "PR", "GU", "VI", "AS", "MP", "UM", "LR", "BS", "BZ", "KY", "PW", "FM", "MH"]);

export function temperatureUnit(country: string | null): TemperatureUnit {
  return country && FAHRENHEIT.has(country.toUpperCase()) ? "F" : "C";
}

// MET Norway's symbol codes ("lightrainshowers_day", "partlycloudy_night",
// "heavysnowandthunder") in plain words.
export function conditionFor(symbolCode: string | null | undefined): WeatherCondition | null {
  if (!symbolCode) return null;
  const [base, time] = symbolCode.toLowerCase().split("_");
  const night = time === "night";
  const strength = base.startsWith("light") ? "light " : base.startsWith("heavy") ? "heavy " : "";
  const showers = base.includes("showers");
  const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

  if (base.includes("thunder")) return { kind: "thunder", label: "Thunderstorms", night };
  if (base.includes("snow")) return { kind: "snow", label: sentence(`${strength}snow${showers ? " showers" : ""}`), night };
  if (base.includes("sleet")) return { kind: "sleet", label: sentence(`${strength}sleet${showers ? " showers" : ""}`), night };
  if (base.includes("rain")) return { kind: "rain", label: sentence(`${strength}${showers ? "showers" : "rain"}`), night };
  if (base === "fog") return { kind: "fog", label: "Fog", night };
  if (base === "partlycloudy") return { kind: "partly", label: "Partly cloudy", night };
  if (base === "cloudy") return { kind: "cloudy", label: "Cloudy", night };
  if (base === "fair") return { kind: "fair", label: night ? "Mostly clear" : "Mostly sunny", night };
  if (base === "clearsky") return { kind: "clear", label: night ? "Clear" : "Sunny", night };
  return null;
}

interface MetPeriod {
  summary?: { symbol_code?: unknown };
}

interface MetEntry {
  time?: unknown;
  data?: {
    instant?: { details?: { air_temperature?: unknown } };
    next_1_hours?: MetPeriod;
    next_6_hours?: MetPeriod;
    next_12_hours?: MetPeriod;
  };
}

interface ForecastPoint {
  time: number;
  temperature: number;
  symbol: string | null; // the next hour where given, else the next six
  daySymbol: string | null; // the next six hours where given
}

const symbolOf = (period: MetPeriod | undefined) =>
  typeof period?.summary?.symbol_code === "string" ? period.summary.symbol_code : null;

function forecastPoints(data: unknown): ForecastPoint[] {
  const series = (data as { properties?: { timeseries?: unknown } } | null)?.properties?.timeseries;
  if (!Array.isArray(series)) return [];
  const points: ForecastPoint[] = [];
  for (const entry of series as MetEntry[]) {
    const time = typeof entry?.time === "string" ? Date.parse(entry.time) : NaN;
    const temperature = entry?.data?.instant?.details?.air_temperature;
    if (!Number.isFinite(time) || typeof temperature !== "number" || !Number.isFinite(temperature)) continue;
    const { next_1_hours, next_6_hours, next_12_hours } = entry.data ?? {};
    points.push({
      time,
      temperature,
      symbol: symbolOf(next_1_hours) ?? symbolOf(next_6_hours) ?? symbolOf(next_12_hours),
      daySymbol: symbolOf(next_6_hours) ?? symbolOf(next_1_hours) ?? symbolOf(next_12_hours),
    });
  }
  return points.sort((a, b) => a.time - b.time);
}

export function summariseForecast(
  data: unknown,
  {
    city,
    unit,
    timeZone,
    now = new Date(),
  }: { city: string | null; unit: TemperatureUnit; timeZone: string | null; now?: Date }
): WeatherSummary | null {
  const namedCity = city?.trim();
  // A temperature without a named place is easy to misread after travelling
  // or when a VPN changes the connection location.
  if (!namedCity) return null;

  const points = forecastPoints(data);
  if (!points.length) return null;

  const zone = timeZone ?? "UTC";
  const nowMs = now.getTime();
  // MET Norway reports tenths of a degree. Preserve that precision rather than
  // rounding the current reading and each daily low/high to a whole degree.
  const toUnit = (celsius: number) => Number((unit === "F" ? (celsius * 9) / 5 + 32 : celsius).toFixed(1));
  const dateOf = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  const hourOf = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" });
  const weekday = new Intl.DateTimeFormat("en-AU", { timeZone: zone, weekday: "short" });
  const fromMidday = (time: number) => Math.abs(Number(hourOf.format(time)) - 12);

  // A cached forecast can be half an hour old: start from the current hour.
  const upcoming = points.filter((point) => point.time + 60 * 60 * 1000 > nowMs);
  const current = upcoming[0];
  // Never present an expired forecast (or tomorrow's temperature) as current.
  if (!current || current.time - nowMs > 60 * 60 * 1000) return null;
  const today = dateOf.format(nowMs);
  // After 6pm what's left of today is the night, and its low and high say so.
  const evening = Number(hourOf.format(nowMs)) >= 18;

  const byDate = new Map<string, ForecastPoint[]>();
  for (const point of upcoming) {
    const date = dateOf.format(point.time);
    byDate.set(date, [...(byDate.get(date) ?? []), point]);
  }

  const days: WeatherDay[] = [];
  for (const [date, dayPoints] of byDate) {
    if (days.length === FORECAST_DAYS) break;
    const temperatures = dayPoints.map((point) => point.temperature);
    // A day's weather is what's expected closest to midday.
    const midday = dayPoints.reduce((best, point) => (fromMidday(point.time) < fromMidday(best.time) ? point : best));
    days.push({
      date,
      label: date === today ? (evening ? "Tonight" : "Today") : weekday.format(midday.time),
      high: toUnit(Math.max(...temperatures)),
      low: toUnit(Math.min(...temperatures)),
      condition: conditionFor(midday.daySymbol),
    });
  }

  return { city: namedCity, unit, temperature: toUnit(current.temperature), condition: conditionFor(current.symbol), days };
}

export async function fetchForecast(
  location: Pick<WeatherLocation, "latitude" | "longitude">,
  { fetchImpl = fetch, timeoutMs = 3000 }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<unknown> {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("lat", String(location.latitude));
  url.searchParams.set("lon", String(location.longitude));
  // The time limit is a timer race rather than an abort signal, so the request
  // stays a plain fetch that Next.js caches. No forecast just means no chip.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeLimit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Timed out")), timeoutMs);
  });
  try {
    const response = await Promise.race([
      fetchImpl(url.toString(), {
        headers: { Accept: "application/json", "User-Agent": WEATHER_USER_AGENT },
        // Kept for half an hour and shared by everyone nearby: MET Norway updates
        // forecasts about that often and asks apps not to re-ask sooner.
        next: { revalidate: 1800 },
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Forecast status ${response.status}`);
        return response.json();
      }),
      timeLimit,
    ]);
    return response;
  } catch (error) {
    console.error("Weather forecast failed", error instanceof Error ? error.message : "unknown error");
    return null;
  } finally {
    clearTimeout(timer);
  }
}
