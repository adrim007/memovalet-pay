import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { billingSelection } from "@/lib/billing-plans";
import { startCheckout } from "@/lib/billing";
export async function POST(req: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  try {
    const body = await req.json();
    const selection = billingSelection(body.plan, body.interval);
    if (!selection) return NextResponse.json({ error: "Choose a valid plan and billing period" }, { status: 400 });
    const seats = body.seats ?? 1;
    if (!Number.isInteger(seats) || seats < 1 || seats > 50 || (selection.plan === "member" && seats !== 1)) return NextResponse.json({ error: "Choose a valid number of paid seats" }, { status: 400 });
    return NextResponse.json({ url: await startCheckout(user, selection.plan, selection.interval, seats) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout could not be opened" }, { status: 503 }); }
}
