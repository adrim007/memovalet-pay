// Suggestions while typing in the home bar's Web mode, from Brave Search's
// Autosuggest API. Google has no official way for other sites to use its own
// suggestions, and copying them from google.com breaks its terms, so this uses
// a provider that offers them. Without BRAVE_SEARCH_API_KEY there are none.

const ENDPOINT = "https://api.search.brave.com/res/v1/suggest/search";
export const MAX_QUERY_LENGTH = 100;
const MAX_PROVIDER_SUGGESTIONS = 8;

// Countries Brave can tailor suggestions to. Everyone else gets worldwide ones.
const BRAVE_COUNTRIES = new Set([
  "AR", "AT", "AU", "BE", "BR", "CA", "CH", "CL", "CN", "DE", "DK", "ES", "FI", "FR", "GB", "HK", "ID", "IN",
  "IT", "JP", "KR", "MX", "MY", "NL", "NO", "NZ", "PH", "PL", "PT", "RU", "SA", "SE", "TR", "TW", "US", "ZA",
]);

// Brave's language codes. Most match browsers'; braveLanguage handles the rest
// (Japanese is "jp", Chinese is split by script, Portuguese by region).
const BRAVE_LANGUAGES = new Set([
  "ar", "eu", "bn", "bg", "ca", "zh-hans", "zh-hant", "hr", "cs", "da", "nl", "en", "en-gb", "et", "fi", "fr",
  "gl", "de", "gu", "he", "hi", "hu", "is", "it", "jp", "kn", "ko", "lv", "lt", "ms", "ml", "mr", "nb", "pl",
  "pt-br", "pt-pt", "pa", "ro", "ru", "sr", "sk", "sl", "es", "sv", "ta", "te", "th", "tr", "uk", "vi",
]);

// From Vercel's x-vercel-ip-country header.
export function suggestionCountry(header: string | null): string {
  const code = header?.trim().toUpperCase() ?? "";
  return BRAVE_COUNTRIES.has(code) ? code : "ALL";
}

// One browser language tag ("en-AU", "zh-Hant-HK", "ja") as Brave spells it, or null.
function braveLanguage(tag: string): string | null {
  const [base, region = ""] = tag.toLowerCase().split("-");
  if (base === "zh") return ["tw", "hk", "mo", "hant"].includes(region) ? "zh-hant" : "zh-hans";
  if (base === "pt") return region === "br" ? "pt-br" : "pt-pt";
  if (base === "en") return region === "gb" ? "en-gb" : "en";
  if (base === "ja") return "jp";
  if (base === "no" || base === "nn") return "nb";
  if (base === "iw") return "he";
  return BRAVE_LANGUAGES.has(base) ? base : null;
}

// From the browser's Accept-Language header ("en-AU,en;q=0.9,fr;q=0.8"): the
// first language Brave supports, in the browser's order of preference.
export function suggestionLanguage(header: string | null): string | null {
  if (!header) return null;
  const tags = header
    .slice(0, 500)
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((param) => /^\s*q=([\d.]+)\s*$/.exec(param)).find(Boolean);
      return { tag: tag.trim(), weight: q ? Number(q[1]) : 1, index };
    })
    .filter((item) => item.tag && item.tag !== "*" && item.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { tag } of tags) {
    const language = braveLanguage(tag);
    if (language) return language;
  }
  return null;
}

export async function fetchWebSuggestions(
  query: string,
  {
    apiKey,
    country,
    lang,
    fetchImpl = fetch,
    timeoutMs = 2500,
  }: {
    apiKey?: string;
    country?: string | null;
    lang?: string | null;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  }
): Promise<string[]> {
  const q = query.trim();
  if (!apiKey || q.length < 2 || q.length > MAX_QUERY_LENGTH) return [];

  const ask = (locale: { country?: string | null; lang?: string | null }) => {
    const url = new URL(ENDPOINT);
    url.searchParams.set("q", q);
    url.searchParams.set("count", String(MAX_PROVIDER_SUGGESTIONS));
    if (locale.country) url.searchParams.set("country", locale.country);
    if (locale.lang) url.searchParams.set("lang", locale.lang);
    return fetchImpl(url.toString(), {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
  };

  // A slow or failed reply just means no suggestions; the Google row still works.
  try {
    let response = await ask({ country, lang });
    // If Brave won't take this country or language, ask again without them
    // rather than show nothing.
    if ((response.status === 400 || response.status === 422) && (country || lang)) {
      console.error("Web suggestions: Brave refused the location", response.status, country, lang);
      response = await ask({});
    }
    if (!response.ok) {
      console.error("Web suggestions failed", response.status);
      return [];
    }
    const data = await response.json();
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const item of Array.isArray(data?.results) ? data.results : []) {
      const text = typeof item?.query === "string" ? item.query.trim() : "";
      if (!text || text.length > 200 || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      suggestions.push(text);
      if (suggestions.length === MAX_PROVIDER_SUGGESTIONS) break;
    }
    return suggestions;
  } catch (error) {
    console.error("Web suggestions failed", error instanceof Error ? error.name : "unknown error");
    return [];
  }
}
