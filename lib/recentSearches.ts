import { mergeRecent, type RecentSearch } from "./searchMenu";

// Recent searches stay on this device, like a browser's history, rather than
// in the database. localStorage doesn't exist during SSR, so — as with
// lib/manualMeetings.ts — a module-level store is read through
// useSyncExternalStore, keeping the server and first client render in sync.
const RECENT_SEARCHES_KEY = "mf-recent-searches";
const EMPTY_RECENT_SEARCHES: RecentSearch[] = [];
let recentCache: RecentSearch[] | null = null;
let recentListeners: (() => void)[] = [];

function readRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentSearch =>
        typeof item?.query === "string" &&
        (item.scope === "MemoValet" || item.scope === "Web") &&
        typeof item.at === "number"
    );
  } catch {
    return [];
  }
}

function writeRecentSearches(next: RecentSearch[]) {
  recentCache = next;
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: recent searches just won't survive a reload
  }
  recentListeners.forEach((listener) => listener());
}

export function getRecentSearchesSnapshot(): RecentSearch[] {
  if (recentCache === null) recentCache = readRecentSearches();
  return recentCache;
}

export function getRecentSearchesServerSnapshot(): RecentSearch[] {
  return EMPTY_RECENT_SEARCHES;
}

export function subscribeRecentSearches(callback: () => void) {
  recentListeners.push(callback);
  return () => {
    recentListeners = recentListeners.filter((listener) => listener !== callback);
  };
}

export function rememberSearch(query: string, scope: RecentSearch["scope"]) {
  writeRecentSearches(mergeRecent(getRecentSearchesSnapshot(), { query, scope, at: Date.now() }));
}

export function forgetSearch(query: string, scope: RecentSearch["scope"]) {
  writeRecentSearches(getRecentSearchesSnapshot().filter((item) => !(item.scope === scope && item.query === query)));
}

export function clearRecentSearches(scope: RecentSearch["scope"]) {
  writeRecentSearches(getRecentSearchesSnapshot().filter((item) => item.scope !== scope));
}
