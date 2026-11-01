/**
 * What the home page shows, and in what order — each person's own choice,
 * saved with their account (user_metadata.home_layout).
 */

export const HOME_CARDS = [
  { id: "search", label: "Search and create", span: 12 },
  { id: "shortcuts", label: "Quick actions", span: 12 },
  { id: "needs-you", label: "Needs you", span: 6 },
  { id: "up-next", label: "Up next", span: 6 },
  { id: "glance", label: "At a glance", span: 12 },
  // "Send something" was folded into Quick actions. A layout saved with it
  // still loads: unknown cards are dropped (see homeLayout).
  { id: "recent-files", label: "Recent files", span: 12 },
] as const;

export type HomeCardId = (typeof HOME_CARDS)[number]["id"];
/** The weather lives beside the greeting, so it can be hidden but not moved. */
export type HomeToggleId = HomeCardId | "weather";

export interface HomeLayout {
  order: HomeCardId[];
  hidden: HomeToggleId[];
}

const CARD_IDS = HOME_CARDS.map((card) => card.id) as HomeCardId[];
const TOGGLE_IDS: HomeToggleId[] = ["weather", ...CARD_IDS];

export const DEFAULT_HOME_LAYOUT: HomeLayout = { order: CARD_IDS, hidden: [] };

/**
 * A saved layout, made safe: unknown cards dropped, none twice, and any card
 * added to MemoValet since it was saved shown at the end — so a new card is
 * never lost to an old layout.
 */
export function homeLayout(saved: unknown): HomeLayout {
  const value = (saved ?? {}) as { order?: unknown; hidden?: unknown };
  const seen = new Set<HomeCardId>();
  const order: HomeCardId[] = [];
  if (Array.isArray(value.order)) {
    for (const id of value.order) {
      if (CARD_IDS.includes(id) && !seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
  }
  // A card someone has never placed (new since they arranged the page) goes at
  // the end, where it can be seen and moved, rather than anywhere surprising.
  for (const id of CARD_IDS) if (!seen.has(id)) order.push(id);
  const hidden = Array.isArray(value.hidden)
    ? TOGGLE_IDS.filter((id) => (value.hidden as unknown[]).includes(id))
    : [];
  return { order, hidden };
}

export function moveCard(layout: HomeLayout, id: HomeCardId, step: -1 | 1): HomeLayout {
  const order = [...layout.order];
  const from = order.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= order.length) return layout;
  [order[from], order[to]] = [order[to], order[from]];
  return { ...layout, order };
}

export function toggleCard(layout: HomeLayout, id: HomeToggleId, shown: boolean): HomeLayout {
  const hidden = layout.hidden.filter((item) => item !== id);
  return { ...layout, hidden: shown ? hidden : [...hidden, id] };
}

/**
 * How wide each shown card is, out of twelve columns. Cards fill rows in order;
 * the last card in a row that isn't full stretches to the end, so hiding or
 * moving a card never leaves a hole in the page.
 */
export function cardWidths(layout: HomeLayout): Array<{ id: HomeCardId; span: number }> {
  const shown = layout.order.filter((id) => !layout.hidden.includes(id));
  const rows: Array<Array<{ id: HomeCardId; span: number }>> = [];
  let row: Array<{ id: HomeCardId; span: number }> = [];
  let used = 0;
  for (const id of shown) {
    const span = HOME_CARDS.find((card) => card.id === id)!.span;
    if (used + span > 12 && row.length) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push({ id, span });
    used += span;
  }
  if (row.length) rows.push(row);
  for (const cards of rows) {
    const total = cards.reduce((sum, card) => sum + card.span, 0);
    cards[cards.length - 1].span += 12 - total;
  }
  return rows.flat();
}
