import {
  createNotification,
  createPaymentRecord,
  getStripeAccountLink,
  setTaskAssignmentPayment,
} from "@/lib/database";
import { sendAppEmail } from "@/lib/email/send";
import { formatMoney } from "@/lib/money";
import { getStripe } from "@/lib/stripe";
import type { TaskAssignment } from "@/lib/types";

export type PaymentRequestResult =
  | { ok: true; url: string; emailed: boolean }
  | { ok: false; reason: "no_amount" | "no_customer" | "stripe_not_configured" | "not_connected" | "already_paid" | "error"; message: string };

// Creates a Stripe-hosted payment page for a job on the business's own
// connected account and emails it to the customer. Used when the assignee
// marks the job done, and by the owner's "Send payment link" button.
export async function requestPaymentForAssignment(
  assignment: TaskAssignment,
  origin: string
): Promise<PaymentRequestResult> {
  if (!assignment.amount_cents) {
    return { ok: false, reason: "no_amount", message: "This job has no price on it." };
  }
  if (!assignment.customer_email) {
    return { ok: false, reason: "no_customer", message: "No customer email on this job." };
  }
  if (assignment.payment_status === "paid") {
    return { ok: false, reason: "already_paid", message: "This job has already been paid." };
  }

  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, reason: "stripe_not_configured", message: "Payments aren't switched on for MemoValet yet." };
  }

  const link = await getStripeAccountLink(assignment.created_by);
  if (!link || !link.charges_enabled) {
    return {
      ok: false,
      reason: "not_connected",
      message: "Connect Stripe in Settings → Get paid before charging customers.",
    };
  }

  const currency = (assignment.currency || "aud").toLowerCase();

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: assignment.customer_email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: assignment.amount_cents,
              product_data: {
                name: assignment.title,
                description: assignment.description || undefined,
              },
            },
          },
        ],
        success_url: `${origin}/pay/thanks`,
        cancel_url: `${origin}/pay/cancelled`,
        metadata: { task_assignment_id: assignment.id, owner_user_id: assignment.created_by },
      },
      { stripeAccount: link.stripe_account_id }
    );

    if (!session.url) {
      return { ok: false, reason: "error", message: "Stripe didn't return a payment page." };
    }

    await createPaymentRecord({
      userId: assignment.created_by,
      taskAssignmentId: assignment.id,
      amountCents: assignment.amount_cents,
      currency,
      customerEmail: assignment.customer_email,
      stripeCheckoutSessionId: session.id,
    });
    await setTaskAssignmentPayment(assignment.id, {
      payment_status: "pending",
      stripe_checkout_session_id: session.id,
    });

    const amount = formatMoney(assignment.amount_cents, currency);
    const emailResult = await sendAppEmail({
      to: assignment.customer_email,
      subject: `Payment for "${assignment.title}" — ${amount}`,
      text:
        `Your job "${assignment.title}" is done.\n\n` +
        `Amount due: ${amount}\n\n` +
        `Pay securely here: ${session.url}\n\n` +
        `Sent via MemoValet.`,
      userId: assignment.created_by,
    });

    await createNotification({
      userId: assignment.created_by,
      type: "payment_requested",
      title: `Payment link for "${assignment.title}" (${amount}) ${emailResult.sent ? "sent to" : "ready for"} ${assignment.customer_email}`,
      link: "/tasks",
    });

    return { ok: true, url: session.url, emailed: emailResult.sent };
  } catch (error) {
    console.error("Stripe checkout failed", error);
    return { ok: false, reason: "error", message: "Couldn't create the payment page. Try again." };
  }
}
