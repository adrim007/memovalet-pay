import type { WeatherPlace } from "./weather";

// Finding a town or city by name, or naming the spot someone is standing in,
// for the weather. Geoapify, like the address boxes (see addressSuggest.ts):
// the browser asks it directly, with the key handed only to signed-in users.

const AUTOCOMPLETE = "https://api.geoapify.com/v1/geocode/autocomplete";
const REVERSE = "https://api.geoapify.com/v1/geocode/reverse";
export const MIN_PLACE_QUERY = 2;

export interface PlaceChoice extends WeatherPlace {
  id: string;
  /** "Victoria, Australia": enough to tell two Richmonds apart. */
  detail: string;
}

interface GeoapifyPlace {
  place_id?: unknown;
  city?: unknown;
  name?: unknown;
  suburb?: unknown;
  county?: unknown;
  state?: unknown;
  country?: unknown;
  country_code?: unknown;
  lat?: unknown;
  lon?: unknown;
  timezone?: { name?: unknown } | null;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function parsePlaces(data: unknown): PlaceChoice[] {
  const results = (data as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  const places: PlaceChoice[] = [];
  for (const result of results as GeoapifyPlace[]) {
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const name = text(result.city) || text(result.name) || text(result.suburb) || text(result.county);
    if (!name) continue;
    const detail = [text(result.state), text(result.country)].filter((part) => part && part !== name).join(", ");
    const key = `${name}|${detail}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const country = text(result.country_code);
    places.push({
      id: text(result.place_id) || key,
      name,
      detail,
      latitude,
      longitude,
      country: /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : null,
      timeZone: text(result.timezone?.name) || null,
    });
    if (places.length === 5) break;
  }
  return places;
}

export function placeSearchUrl(
  query: string,
  { apiKey, near, lang }: { apiKey: string; near?: { latitude: number; longitude: number } | null; lang?: string | null }
): string {
  const url = new URL(AUTOCOMPLETE);
  url.searchParams.set("text", query.trim().slice(0, 100));
  // Towns and cities, anywhere: someone travelling wants where they are now.
  url.searchParams.set("type", "city");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  if (near) url.searchParams.set("bias", `proximity:${near.longitude},${near.latitude}`);
  if (lang) url.searchParams.set("lang", lang);
  url.searchParams.set("apiKey", apiKey);
  return url.toString();
}

export function reversePlaceUrl(
  latitude: number,
  longitude: number,
  { apiKey, lang }: { apiKey: string; lang?: string | null }
): string {
  const url = new URL(REVERSE);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("type", "city");
  url.searchParams.set("format", "json");
  if (lang) url.searchParams.set("lang", lang);
  url.searchParams.set("apiKey", apiKey);
  return url.toString();
}
