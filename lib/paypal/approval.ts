import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { InvoiceDraft } from "@/lib/paypal/client";

// The money step needs a person. The AI may propose an invoice, but sending needs an approval
// token that only the Approve tap in the screen can create. The token is signed and lists the
// exact payer, currency, total and items the person saw, and it runs out after 15 minutes.

export const APPROVAL_MINUTES = 15;
const secret = process.env.MEMOVALET_APPROVAL_SECRET?.trim() || randomBytes(32).toString("hex");

export type Approval = { proposalId: string; run: string; payerEmail: string; currency: string; total: string; items: string; dueDate: string; approvedAt: string; expires: number };

const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const sign = (body: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function totalOf(draft: InvoiceDraft) {
  const cents = draft.items.reduce((sum, item) => sum + Math.round(Number(item.unitAmount) * 100) * item.quantity, 0);
  return (cents / 100).toFixed(2);
}

export function itemsKey(draft: InvoiceDraft) {
  return draft.items.map(item => `${item.quantity}x${item.unitAmount} ${item.name}`).join("|");
}

// `run` is one go through the flow on the screen. Tapping Approve again in the same run keeps it.
export function approve(proposalId: string, draft: InvoiceDraft, now = Date.now(), run: string = randomUUID()): string {
  const approval: Approval = {
    proposalId, run, payerEmail: draft.payerEmail.toLowerCase(), currency: draft.currency, total: totalOf(draft),
    items: itemsKey(draft), dueDate: draft.dueDate, approvedAt: new Date(now).toISOString(), expires: now + APPROVAL_MINUTES * 60_000,
  };
  const body = b64(JSON.stringify(approval));
  return `${body}.${sign(body)}`;
}

export type GateResult = { ok: true; approval: Approval } | { ok: false; reason: string };

// Refuses unless the token is genuine, unexpired, and matches the invoice exactly.
export function checkApproval(token: string | undefined, proposalId: string, draft: InvoiceDraft, now = Date.now()): GateResult {
  if (!token) return { ok: false, reason: "Not sent. The person has not approved this invoice. Show the invoice card and wait for Approve." };
  const parts = token.split(".");
  const [body, mac] = parts;
  const expected = body ? sign(body) : "";
  if (parts.length !== 2 || !body || !mac || mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
    return { ok: false, reason: "Not sent. The approval is not valid." };
  }
  const approval = JSON.parse(Buffer.from(body, "base64url").toString()) as Approval;
  if (now > approval.expires) return { ok: false, reason: `Not sent. The approval is more than ${APPROVAL_MINUTES} minutes old. Ask the person to approve again.` };
  if (approval.proposalId !== proposalId) return { ok: false, reason: "Not sent. The approval is for a different invoice." };
  if (approval.payerEmail !== draft.payerEmail.toLowerCase()) return { ok: false, reason: "Not sent. The payer email is not the one the person approved." };
  if (approval.currency !== draft.currency) return { ok: false, reason: "Not sent. The currency is not the one the person approved." };
  if (approval.total !== totalOf(draft) || approval.items !== itemsKey(draft)) return { ok: false, reason: "Not sent. The amount or items are not the ones the person approved." };
  if (approval.dueDate !== draft.dueDate) return { ok: false, reason: "Not sent. The due date is not the one the person approved." };
  return { ok: true, approval };
}

// One tap sends one invoice. A repeated call with the same approval is refused, so a retry or a
// second tool call can't bill the payer twice.
const spent = new Map<string, number>();
export function spendApproval(token: string, approval: Approval, now = Date.now()) {
  for (const [key, expires] of spent) if (now > expires) spent.delete(key);
  if (spent.has(token)) return false;
  spent.set(token, approval.expires);
  return true;
}

// The same run always gets the same invoice number, and PayPal refuses a number it has seen. So a
// retry, a second tap or a restart finds the first invoice instead of billing the payer again.
export function invoiceNumber(approval: Approval) {
  return `MV${createHash("sha256").update(`${approval.run}|${approval.proposalId}`).digest("hex").slice(0, 16).toUpperCase()}`;
}
