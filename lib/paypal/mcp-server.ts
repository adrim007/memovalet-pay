import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { checkApproval, invoiceNumber, spendApproval } from "@/lib/paypal/approval";
import { createPayPalClient } from "@/lib/paypal/client";
import { draftPaymentReminder, proposeInvoice, sampleMeeting } from "@/lib/paypal/invoice-flow";

function content(value: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value };
}
function refuse(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

// MemoValet Pay's MCP server: the AI can read and propose; only send_invoice moves anything,
// and only with the person's approval token for exactly that invoice.
export function buildPayServer(paypal = () => createPayPalClient()) {
  const server = new McpServer({ name: "memovalet-pay-sandbox", version: "1.0.0" });
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  server.registerTool("propose_invoice", {
    description: "Read the fictional sample meeting and propose the invoice that was agreed in it: payer, items, amount, currency and due date. A draft only; it creates nothing in PayPal. Show it to the person as a card for approval.",
    inputSchema: {}, annotations: readOnly,
  }, async () => content({ meeting: { title: sampleMeeting.title, transcriptExcerpt: sampleMeeting.transcriptExcerpt }, ...proposeInvoice() }));
  server.registerTool("send_invoice", {
    description: "Create and send the approved invoice in the PayPal sandbox (test money only). Only works with the approval token the person's Approve tap created, and only for exactly the proposal they approved. Never guess or reuse a token.",
    inputSchema: { proposalId: z.string().min(1).max(100), approvalToken: z.string().min(1).max(4000).optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ proposalId, approvalToken }) => {
    const proposal = proposeInvoice();
    if (proposalId !== proposal.proposalId) return refuse("Not sent. Unknown proposal. Call propose_invoice first.");
    const gate = checkApproval(approvalToken, proposal.proposalId, proposal.draft);
    if (!gate.ok) return refuse(gate.reason);
    if (!spendApproval(approvalToken!, gate.approval)) return refuse("Not sent again. This approval was already used to send the invoice. Check its status instead.");
    try {
      const client = paypal();
      const number = invoiceNumber(gate.approval);
      const invoice = await client.findByNumber(number) ?? await client.createDraft(proposal.draft, number);
      const sent = invoice.status === "DRAFT" ? await client.send(invoice.id) : invoice;
      return content({ invoice: sent, approvedAt: gate.approval.approvedAt, sandbox: true });
    } catch (error) {
      return refuse(error instanceof Error ? error.message : "PayPal sandbox call failed.");
    }
  });
  server.registerTool("invoice_status", {
    description: "Read an invoice's status from the PayPal sandbox (for example SENT, UNPAID, PAID).",
    inputSchema: { invoiceId: z.string().min(1).max(100) }, annotations: { ...readOnly, idempotentHint: false, openWorldHint: true },
  }, async ({ invoiceId }) => {
    try { return content({ invoice: await paypal().status(invoiceId), sandbox: true }); }
    catch (error) { return refuse(error instanceof Error ? error.message : "PayPal sandbox call failed."); }
  });
  server.registerTool("draft_payment_reminder", {
    description: "Write a polite reminder for an unpaid invoice that is past its due date. Drafts only; nothing is sent.",
    inputSchema: { invoiceId: z.string().min(1).max(100) }, annotations: { ...readOnly, openWorldHint: true },
  }, async ({ invoiceId }) => {
    try { return content({ reminder: draftPaymentReminder(await paypal().status(invoiceId), sampleMeeting.agreedPayment.payerName) }); }
    catch (error) { return refuse(error instanceof Error ? error.message : "PayPal sandbox call failed."); }
  });
  return server;
}
