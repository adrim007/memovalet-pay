import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  createNotification,
  findUserIdByStripeAccount,
  markPaymentPaid,
  upsertStripeAccountLink,
} from "@/lib/database";
import { formatMoney } from "@/lib/money";
import { getStripe } from "@/lib/stripe";

// Stripe → MemoValet. Register this URL in the Stripe dashboard as a
// Connect webhook ("Listen to events on Connected accounts") for
// checkout.session.completed and account.updated, and put the signing
// secret in STRIPE_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("Stripe webhook signature check failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") break;
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
        const { userId } = await markPaymentPaid({
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        });
        if (userId && session.amount_total != null) {
          await createNotification({
            userId,
            type: "payment_received",
            title: `Paid: ${formatMoney(session.amount_total, session.currency || "aud")} from ${session.customer_details?.email || session.customer_email || "a customer"}`,
            link: "/tasks",
          });
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const userId = await findUserIdByStripeAccount(account.id);
        if (userId) {
          await upsertStripeAccountLink({
            userId,
            stripeAccountId: account.id,
            chargesEnabled: !!account.charges_enabled,
            detailsSubmitted: !!account.details_submitted,
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handling failed", error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
