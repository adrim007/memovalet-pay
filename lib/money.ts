// Client-safe money helpers.

export function formatMoney(cents: number, currency = "aud"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

// "45", "45.50", "$45.50" → 4550. Returns null for anything that isn't a
// positive amount.
export function parseAmountToCents(input: string): number | null {
  const clean = input.replace(/[^0-9.]/g, "");
  if (!clean) return null;
  const value = Number(clean);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}
