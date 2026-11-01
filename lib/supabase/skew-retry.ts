// Supabase's auth server can stamp a fresh token a moment ahead of the database
// server's clock. The database then refuses it — "JWT issued at future",
// PGRST303 — and that one request comes back empty: typically a panel of the
// dashboard right after logging in. The token is valid a second later, so that
// specific refusal is retried once, after a short pause. Nothing else is.
const SKEW_CODE = "PGRST303";
const PAUSE_MS = 1200;

type Fetch = typeof fetch;

export function withClockSkewRetry(baseFetch: Fetch, pause = (ms: number) => new Promise((r) => setTimeout(r, ms))): Fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    if (response.status !== 401) return response;

    // Only bodies that can be sent twice. Supabase sends JSON strings; a
    // stream would already be spent.
    const body = init?.body;
    if (body != null && typeof body !== "string") return response;

    const text = await response.clone().text().catch(() => "");
    if (!text.includes(SKEW_CODE)) return response;

    await pause(PAUSE_MS);
    return baseFetch(input, init);
  };
}
