import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { reportedError } from "@/lib/error-report";

/**
 * Where a browser says something broke.
 *
 * Open to anyone on the site, including guests in a call — a fault that stops
 * someone signing in is exactly the one worth hearing about, and they have no
 * account by definition. Kept small and dull on purpose: a short message, a
 * page path with ids stripped, the build, and a one-word browser. See
 * lib/error-report for what is deliberately not kept.
 */
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const error = reportedError(body, { userAgent: req.headers.get("user-agent"), source: "client" });
  // Nothing worth keeping is not a failure; the page should never care.
  if (!error) return NextResponse.json({ ok: true });

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // A signed-out visitor, or auth having a bad day. The report still lands.
  }

  const { error: failed } = await createServiceClient()
    .from("app_errors")
    .insert({ ...error, user_id: userId });
  if (failed) console.error("Could not keep an error report", failed.code);
  return NextResponse.json({ ok: true });
}
