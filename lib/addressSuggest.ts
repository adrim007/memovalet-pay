// Address suggestions while typing a location (sending a job, a task's
// location), from Geoapify's Address Autocomplete API. Geoapify rather than
// Google: no card needed, 3,000 free lookups a day, and commercial use is
// allowed with a "Powered by Geoapify" credit, which the dropdown shows. It's
// built on OpenStreetMap, so some house numbers may be missing.
//
// The browser asks Geoapify itself. Asked from our servers (Tokyo), Geoapify
// often took over 3 seconds and timed out even on a second try; from Melbourne
// it answered in about half a second, and Vercel's Hobby plan can't run one
// function in another region. The key is handed only to signed-in users
// (app/api/address/config) and is meant to be locked to memovalet.com in
// Geoapify's key settings.

const ENDPOINT = "https://api.geoapify.com/v1/geocode/autocomplete";
export const MIN_QUERY_LENGTH = 3;
export const MAX_QUERY_LENGTH = 200;
const MAX_SUGGESTIONS = 5;

// Each try gets 3 seconds; a try that times out or can't connect is made once more.
const ATTEMPT_TIMEOUT_MS = 3000;
const ATTEMPTS = 2;

export interface AddressSuggestion {
  id: string;
  label: string; // the whole address, which goes in the box
  main: string; // "12 Smith Street"
  secondary: string; // "Tuggerah NSW 2259, Australia"
}

// What a location box needs to ask Geoapify directly.
export interface AddressLookupConfig {
  key: string;
  near: { latitude: number; longitude: number } | null;
  country: string | null;
  lang: string | null;
}

interface GeoapifyResult {
  formatted?: unknown;
  address_line1?: unknown;
  address_line2?: unknown;
  place_id?: unknown;
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function parseAddressSuggestions(data: unknown): AddressSuggestion[] {
  const results = (data as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];
  for (const result of results as GeoapifyResult[]) {
    const label = clean(result?.formatted);
    if (!label || label.length > 300 || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    const main = clean(result.address_line1) || label;
    const secondary = clean(result.address_line2);
    suggestions.push({ id: clean(result.place_id) || label, label, main, secondary: secondary === main ? "" : secondary });
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return suggestions;
}

// "en-AU,en;q=0.9" → "en": Geoapify takes two-letter language codes.
export function addressLanguage(acceptLanguage: string | null): string | null {
  const first = acceptLanguage?.split(",")[0]?.trim().slice(0, 2).toLowerCase() ?? "";
  return /^[a-z]{2}$/.test(first) ? first : null;
}

// Stops a try when the caller moves on or its time runs out, whichever is first.
function trySignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  const any = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  return any ? any.call(AbortSignal, [signal, timeout]) : signal;
}

// An empty list means no address matched; null means there's no answer (Geoapify
// couldn't be reached, or the caller moved on), which must not be remembered as
// "no addresses".
export async function fetchAddressSuggestions(
  query: string,
  {
    apiKey,
    near,
    country,
    lang,
    signal,
    // Called through a wrapper: browsers refuse a detached `fetch`.
    fetchImpl = (input, init) => fetch(input, init),
    timeoutMs = ATTEMPT_TIMEOUT_MS,
    attempts = ATTEMPTS,
  }: {
    apiKey?: string;
    near?: { latitude: number; longitude: number } | null;
    country?: string | null;
    lang?: string | null;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    attempts?: number;
  }
): Promise<AddressSuggestion[] | null> {
  const q = query.trim();
  if (!apiKey || q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) return [];

  const url = new URL(ENDPOINT);
  url.searchParams.set("text", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(MAX_SUGGESTIONS));
  // Only the typist's own country, nearest first. Proximity alone is a light
  // nudge: "190 Sydney Road" typed in Melbourne listed Canada and the US first.
  if (country && /^[a-z]{2}$/i.test(country)) url.searchParams.set("filter", `countrycode:${country.toLowerCase()}`);
  if (near) url.searchParams.set("bias", `proximity:${near.longitude},${near.latitude}`);
  if (lang) url.searchParams.set("lang", lang);
  url.searchParams.set("apiKey", apiKey);

  // Never log the URL or an error's message: they can carry the key.
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (signal?.aborted) return null;
    try {
      const response = await fetchImpl(url.toString(), {
        headers: { Accept: "application/json" },
        signal: trySignal(signal, timeoutMs),
      });
      if (!response.ok) {
        // An answer, just not a usable one: asking again won't change it.
        console.error("Address suggestions failed", response.status);
        return null;
      }
      return parseAddressSuggestions(await response.json());
    } catch (error) {
      // Typing moved on: nothing to report, and no point asking again.
      if (signal?.aborted) return null;
      console.error("Address suggestions failed", error instanceof Error ? error.name : "unknown error", `(try ${attempt} of ${attempts})`);
    }
  }
  return null;
}
