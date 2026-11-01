import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { billingAccount, refreshBilling, withBillingLock } from "@/lib/billing";
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Billing webhook is not configured" }, { status: 503 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") || "", secret); }
  catch { return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }
  if (event.account || !["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed", "invoice.paid", "invoice.payment_failed"].includes(event.type)) return NextResponse.json({ received: true });
  try {
    const object = event.data.object as { customer?: string | { id: string } | null };
    const customer = typeof object.customer === "string" ? object.customer : object.customer?.id;
    if (customer) {
      const { data, error } = await createServiceClient().from("billing_accounts").select("user_id").eq("customer_id", customer).maybeSingle();
      if (error) throw error;
      if (data) await withBillingLock(data.user_id, async () => {
        const account = await billingAccount(data.user_id);
        if (account) await refreshBilling(stripe, account);
      });
    }
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ error: "Billing update could not be applied. Please retry." }, { status: 500 }); }
}
