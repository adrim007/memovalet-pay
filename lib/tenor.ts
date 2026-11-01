/**
 * Searching Tenor's library from the meeting chat, the way Teams does.
 *
 * Two rules shape this. The search runs on MemoValet's side, not in the
 * browser, so Tenor is told a search happened but never who is in the meeting
 * or where they are. And the content filter is fixed at Tenor's strictest,
 * `high` — G-rated only, by their own definition — set here in code with
 * nothing in the browser able to change it, because these land in a call in
 * front of clients.
 *
 * Anything that comes back is checked before it is offered: https, Tenor's own
 * media host, ending in .gif, exactly what the chat itself will accept when
 * the GIF is sent (see meeting-chat's safeGifUrl).
 */

const ENDPOINT = "https://tenor.googleapis.com/v2/search";

/** Tenor's strictest level: "G" — see their content filtering guide. */
export const CONTENT_FILTER = "high";
export const MAX_RESULTS = 24;
export const MIN_QUERY = 2;
export const MAX_QUERY = 50;

export interface TenorGif {
  key: string;
  label: string;
  /** Small animated version for the picker grid. */
  preview: string;
  /** The .gif that is actually sent. */
  url: string;
}

export function tenorSearchUrl(
  query: string,
  options: { key: string; clientKey?: string; locale?: string | null; country?: string | null; limit?: number }
): string {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query.trim().slice(0, MAX_QUERY));
  url.searchParams.set("key", options.key);
  url.searchParams.set("client_key", options.clientKey || "memovalet");
  // G-rated only. Never taken from the request.
  url.searchParams.set("contentfilter", CONTENT_FILTER);
  url.searchParams.set("media_filter", "gif,tinygif");
  url.searchParams.set("limit", String(Math.min(options.limit ?? MAX_RESULTS, MAX_RESULTS)));
  if (options.locale) url.searchParams.set("locale", options.locale);
  if (options.country) url.searchParams.set("country", options.country);
  return url.toString();
}

/** The same check the chat applies to a GIF before it will send it. */
function playable(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname !== "media.tenor.com" && !/^media[0-9]*\.tenor\.com$/.test(url.hostname)) return null;
    if (!url.pathname.toLowerCase().endsWith(".gif")) return null;
    return url.href;
  } catch {
    return null;
  }
}

interface TenorResult {
  id?: unknown;
  content_description?: unknown;
  media_formats?: { gif?: { url?: unknown }; tinygif?: { url?: unknown } };
}

export function parseTenorResults(data: unknown, limit = MAX_RESULTS): TenorGif[] {
  const results = (data as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const gifs: TenorGif[] = [];
  const seen = new Set<string>();
  for (const item of results as TenorResult[]) {
    const url = playable(item?.media_formats?.gif?.url);
    if (!url || seen.has(url)) continue;
    // A preview that fails the same check is not worth loading either; fall
    // back to the full one rather than dropping the result.
    const preview = playable(item?.media_formats?.tinygif?.url) ?? url;
    const described = typeof item.content_description === "string" ? item.content_description.trim() : "";
    seen.add(url);
    gifs.push({
      key: typeof item.id === "string" && item.id ? item.id : url,
      label: (described || "GIF").slice(0, 80),
      preview,
      url,
    });
    if (gifs.length === limit) break;
  }
  return gifs;
}
