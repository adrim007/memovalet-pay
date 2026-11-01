import type { InvoiceDraft, InvoiceStatus } from "@/lib/paypal/client";
import { totalOf } from "@/lib/paypal/approval";

// The fictional sample meeting behind the MemoValet Pay demo. A paid item was agreed out loud;
// MemoValet turns it into an invoice proposal. Nothing here talks to PayPal.

export const sampleMeeting = {
  id: "harbour-kickoff",
  title: "Website refresh kickoff with Harbour Bakery",
  attendees: ["You (Bright Lane Studio)", "Sam Patel (Harbour Bakery)"],
  transcriptExcerpt: [
    "Sam: Happy to go ahead with the website refresh.",
    "You: Great. I'll send the deposit invoice today, 500 dollars, due within a week, and we start once it's paid.",
    "Sam: Perfect, send it to my accounts address.",
  ],
  agreedPayment: {
    payerName: "Sam Patel",
    item: "Website refresh: 50% deposit",
    quantity: 1,
    unitAmount: "500.00",
    currency: "AUD",
    daysToPay: 7,
  },
  sample: true,
};

export type InvoiceProposal = { proposalId: string; source: { meetingId: string; meeting: string; quote: string }; payerName: string; draft: InvoiceDraft; total: string; sample: true };

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function proposeInvoice(env: Record<string, string | undefined> = process.env, today = new Date()): InvoiceProposal {
  const paid = sampleMeeting.agreedPayment;
  const due = new Date(today);
  due.setDate(due.getDate() + paid.daysToPay);
  const draft: InvoiceDraft = {
    // A sandbox buyer account receives the test invoice. The default is a placeholder address.
    payerEmail: env.PAYPAL_SANDBOX_BUYER_EMAIL?.trim() || "sam@harbourbakery.example",
    currency: paid.currency,
    dueDate: localDate(due),
    note: `From "${sampleMeeting.title}". Sample invoice in the PayPal sandbox; no real money.`,
    items: [{ name: paid.item, quantity: paid.quantity, unitAmount: paid.unitAmount }],
  };
  return {
    proposalId: `${sampleMeeting.id}-deposit`,
    source: { meetingId: sampleMeeting.id, meeting: sampleMeeting.title, quote: sampleMeeting.transcriptExcerpt[1] },
    payerName: paid.payerName,
    draft,
    total: totalOf(draft),
    sample: true,
  };
}

export type ReminderDraft = { status: "draft"; to?: string; subject: string; body: string; sent: false } | { status: "not_needed"; reason: string; sent: false };

// Writes a polite reminder for an unpaid invoice that is past its due date. It never sends anything.
export function draftPaymentReminder(invoice: InvoiceStatus, payerName: string, today = new Date()): ReminderDraft {
  if (invoice.status === "PAID" || invoice.status === "MARKED_AS_PAID") return { status: "not_needed", reason: "This invoice is paid.", sent: false };
  if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") return { status: "not_needed", reason: `This invoice is ${invoice.status.toLowerCase()}, so there is nothing to chase.`, sent: false };
  const due = invoice.dueDate ?? "";
  if (!due || due >= localDate(today)) return { status: "not_needed", reason: due ? `It isn't due until ${due}.` : "The invoice has no due date.", sent: false };
  const amount = invoice.amount ? `${invoice.amount.currency_code} ${invoice.amount.value}` : "the invoice";
  const first = payerName.split(" ")[0] || "there";
  return {
    status: "draft",
    to: invoice.payerEmail,
    subject: `Friendly reminder: ${amount} was due on ${due}`,
    body: `Hi ${first},\n\nA quick reminder that the deposit invoice for ${amount} was due on ${due}. If it's already on its way, thank you and please ignore this.\nYou can pay it here: ${invoice.href ?? "(link from PayPal)"}\n\nThanks,\nBright Lane Studio`,
    sent: false,
  };
}
