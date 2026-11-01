import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { billingAccount, billingOrigin } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
export async function POST(req: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  try {
    const account = await billingAccount(user.id);
    const stripe = getStripe();
    if (!stripe || !account?.customer_id) return NextResponse.json({ error: "No billing account is available yet" }, { status: 400 });
    const session = await stripe.billingPortal.sessions.create({ customer: account.customer_id, return_url: `${billingOrigin()}/billing` });
    return NextResponse.json({ url: session.url });
  } catch { return NextResponse.json({ error: "Billing could not be opened. Please retry or contact support." }, { status: 503 }); }
}
