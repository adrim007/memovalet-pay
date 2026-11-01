// The home search bar's dropdown: what it lists, and in what order. Pure, so
// the rules can be tested without a browser.

export type SearchScope = "MemoValet" | "Web" | "Create";

export interface RecentSearch {
  query: string;
  scope: "MemoValet" | "Web";
  at: number;
}

// As /api/search returns them.
export interface SearchMatch {
  id: string;
  kind: string;
  title: string;
  href: string;
}

// A link kept with the Save button (Notes → Saved links).
export interface SavedLink {
  id: string;
  title: string;
  url: string;
}

export type SearchOption =
  | { type: "site"; key: string; label: string; url: string }
  | { type: "action"; key: string; label: string; query: string; scope: "MemoValet" | "Web" }
  | { type: "recent"; key: string; recent: RecentSearch }
  | { type: "suggestion"; key: string; query: string }
  | { type: "match"; key: string; match: SearchMatch }
  | { type: "link"; key: string; link: SavedLink };

export const MAX_RECENT = 8;
const MAX_RECENT_WHILE_TYPING = 3;
const MAX_MATCHES = 6;
const MAX_SUGGESTIONS = 6;
const MAX_LINKS = 3;

const sameQuery = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Endings common enough that "abc.com.au" means a website, while "node.js" or
// "report.pdf" stay a search.
const WEBSITE_ENDINGS = new Set([
  "com", "net", "org", "edu", "gov", "io", "co", "ai", "app", "dev", "me", "info", "biz", "xyz", "tech",
  "site", "online", "store", "shop", "blog", "news", "tv", "au", "nz", "uk", "us", "ca", "ie", "sg", "in",
  "de", "fr", "eu", "jp",
]);
const WEBSITE = /^(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,63})(?::\d{1,5})?(?:[/?#]\S*)?$/i;

// Like a browser's address bar: "abc.com.au" or "https://abc.com.au/x" is the
// address to open. Plain words, and anything that isn't a web link, are null.
export function websiteFromQuery(text: string): string | null {
  const clean = text.trim();
  if (clean.length > 2048) return null;
  const found = WEBSITE.exec(clean);
  if (!found || !WEBSITE_ENDINGS.has(found[1].toLowerCase())) return null;
  try {
    return new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`).toString();
  } catch {
    return null;
  }
}

// Newest first, one entry per query in each scope, capped.
export function mergeRecent(list: RecentSearch[], entry: RecentSearch, max = MAX_RECENT): RecentSearch[] {
  const query = entry.query.trim();
  if (!query) return list;
  const rest = list.filter((item) => !(item.scope === entry.scope && sameQuery(item.query, query)));
  return [{ ...entry, query }, ...rest].slice(0, max);
}

export function searchOptions(input: {
  query: string;
  scope: SearchScope;
  recents: RecentSearch[];
  matches: SearchMatch[];
  suggestions?: string[];
  links?: SavedLink[];
}): SearchOption[] {
  if (input.scope === "Create") return [];
  const scope = input.scope;
  const query = input.query.trim();
  const recents = input.recents.filter((item) => item.scope === scope);
  const recentOption = (recent: RecentSearch): SearchOption => ({
    type: "recent",
    key: `recent-${recent.scope}-${recent.query}`,
    recent,
  });

  // Nothing typed yet: the dropdown is your history, like a browser's.
  if (!query) return recents.slice(0, MAX_RECENT).map(recentOption);

  const lower = query.toLowerCase();
  const options: SearchOption[] = [];
  const website = scope === "Web" ? websiteFromQuery(query) : null;
  if (website) {
    options.push({ type: "site", key: "site", label: `Go to ${query.replace(/^https?:\/\//i, "")}`, url: website });
  }
  options.push({
    type: "action",
    key: "action",
    label: scope === "Web" ? `Search Google for “${query}”` : `Ask MemoValet “${query}”`,
    query,
    scope,
  });

  // Words already on the list, so nothing shows twice.
  const listed = new Set([lower]);
  recents
    .filter((item) => item.query.toLowerCase().includes(lower) && !listed.has(item.query.trim().toLowerCase()))
    .slice(0, MAX_RECENT_WHILE_TYPING)
    .forEach((recent) => {
      listed.add(recent.query.trim().toLowerCase());
      options.push(recentOption(recent));
    });

  if (scope === "Web") {
    let shown = 0;
    for (const raw of input.suggestions ?? []) {
      const suggestion = raw.trim();
      const key = suggestion.toLowerCase();
      if (!suggestion || listed.has(key)) continue;
      listed.add(key);
      options.push({ type: "suggestion", key: `suggestion-${key}`, query: suggestion });
      if (++shown === MAX_SUGGESTIONS) break;
    }
    (input.links ?? [])
      .filter((link) => link.title.toLowerCase().includes(lower) || link.url.toLowerCase().includes(lower))
      .slice(0, MAX_LINKS)
      .forEach((link) => options.push({ type: "link", key: `link-${link.id}`, link }));
  } else {
    input.matches.slice(0, MAX_MATCHES).forEach((match) =>
      options.push({ type: "match", key: `match-${match.kind}-${match.id}`, match })
    );
  }
  return options;
}

// Splits text into plain and matching runs, case-insensitively, for highlighting.
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, match: false }];
  const haystack = text.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let from = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
    at = haystack.indexOf(needle, from);
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
