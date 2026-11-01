import { NextResponse } from "next/server";
import { TokenVerifier } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { MAX_QUERY, MIN_QUERY, parseTenorResults, tenorSearchUrl } from "@/lib/tenor";

/**
 * GIF search for the meeting chat.
 *
 * Asked from here rather than from the browser so the key stays on this side
 * and Tenor learns only that a search happened — not who is in the meeting or
 * what their address is. The content filter is fixed in lib/tenor at Tenor's
 * strictest and cannot be set from the request.
 *
 * With no key configured this answers politely with nothing, and the picker
 * falls back to MemoValet's own GIFs rather than showing an error.
 */
export async function GET(req: Request) {
  if (req.headers.get("origin") && req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const key = process.env.TENOR_API_KEY;
  if (!key) return NextResponse.json({ enabled: false, results: [] });

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") || "").trim();
  if (query.length < MIN_QUERY || query.length > MAX_QUERY) {
    return NextResponse.json({ enabled: true, results: [] });
  }

  // In this call, or signed in. Guests join calls by link and have no account,
  // so the call's own pass counts — the same one the rest of the call uses.
  const room = url.searchParams.get("session") || "";
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const apiKey = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const claims = token && apiKey && secret
    ? await new TokenVerifier(apiKey, secret).verify(token).catch(() => null)
    : null;
  const inThisCall = Boolean(claims?.video?.roomJoin && room && claims.video.room === room);
  if (!inThisCall) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Join a call or sign in to search GIFs" }, { status: 401 });
  }

  try {
    const response = await fetch(
      tenorSearchUrl(query, {
        key,
        locale: req.headers.get("accept-language")?.split(",")[0]?.replace("-", "_").slice(0, 5) || null,
        country: req.headers.get("x-vercel-ip-country"),
      }),
      { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } }
    );
    if (!response.ok) {
      // Never log the URL: it carries the key.
      console.error("GIF search failed", response.status);
      return NextResponse.json({ enabled: true, results: [] });
    }
    return NextResponse.json(
      { enabled: true, results: parseTenorResults(await response.json()) },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (error) {
    console.error("GIF search failed", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({ enabled: true, results: [] });
  }
}
