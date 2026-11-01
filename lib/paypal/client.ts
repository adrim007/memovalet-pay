import { paypalConfig, type PayPalConfig } from "@/lib/paypal/sandbox";

// Plain HTTPS calls to PayPal's Invoicing v2 API in the sandbox. No SDK and no paid service.
// `fetcher` is swappable so the tests never reach the network.

export type Money = { currency_code: string; value: string };
export type InvoiceDraft = {
  payerEmail: string;
  currency: string;
  dueDate: string; // YYYY-MM-DD
  note: string;
  items: { name: string; quantity: number; unitAmount: string }[];
};
export type InvoiceStatus = { id: string; status: string; amount?: Money; payerEmail?: string; dueDate?: string; href?: string };

type Fetcher = typeof fetch;

export class PayPalError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

export function createPayPalClient(options: { config?: PayPalConfig; fetcher?: Fetcher } = {}) {
  const config = options.config ?? paypalConfig();
  const fetcher = options.fetcher ?? fetch;
  let cached: { token: string; until: number } | null = null;

  async function token() {
    if (cached && Date.now() < cached.until) return cached.token;
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const res = await fetcher(`${config.apiBase}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new PayPalError("PayPal sandbox refused the app's ID or secret. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.", res.status);
    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new PayPalError("PayPal sandbox sent no access token.");
    cached = { token: data.access_token, until: Date.now() + Math.max(60, (data.expires_in ?? 300) - 60) * 1000 };
    return cached.token;
  }

  async function call(path: string, init: RequestInit = {}) {
    const res = await fetcher(`${config.apiBase}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) throw new PayPalError(`PayPal sandbox said ${res.status}: ${body.message ?? body.name ?? "request failed"}`, res.status);
    return body;
  }

  // The parts of PayPal's invoice that MemoValet shows.
  type PayPalInvoice = {
    id: string; status: string; amount?: Money;
    primary_recipients?: { billing_info?: { email_address?: string } }[];
    detail?: { invoice_number?: string; payment_term?: { due_date?: string }; metadata?: { recipient_view_url?: string } };
  };

  function summary(invoice: PayPalInvoice): InvoiceStatus {
    return {
      id: invoice.id,
      status: invoice.status,
      amount: invoice.amount ? { currency_code: invoice.amount.currency_code, value: invoice.amount.value } : undefined,
      payerEmail: invoice.primary_recipients?.[0]?.billing_info?.email_address,
      dueDate: invoice.detail?.payment_term?.due_date,
      href: invoice.detail?.metadata?.recipient_view_url,
    };
  }

  return {
    token,
    async findByNumber(invoiceNumber: string): Promise<InvoiceStatus | null> {
      const page = await call("/v2/invoicing/search-invoices?page=1&page_size=5", { method: "POST", body: JSON.stringify({ invoice_number: invoiceNumber }) });
      const match = (page.items ?? []).find((item: PayPalInvoice) => item.detail?.invoice_number === invoiceNumber);
      return match ? summary(await call(`/v2/invoicing/invoices/${encodeURIComponent(match.id)}`)) : null;
    },
    async createDraft(draft: InvoiceDraft, invoiceNumber?: string): Promise<InvoiceStatus> {
      const invoice = await call("/v2/invoicing/invoices", {
        method: "POST",
        body: JSON.stringify({
          detail: { currency_code: draft.currency, note: draft.note, payment_term: { due_date: draft.dueDate }, ...(invoiceNumber ? { invoice_number: invoiceNumber } : {}) },
          primary_recipients: [{ billing_info: { email_address: draft.payerEmail } }],
          items: draft.items.map(item => ({
            name: item.name, quantity: String(item.quantity),
            unit_amount: { currency_code: draft.currency, value: item.unitAmount },
          })),
        }),
      });
      return summary(invoice);
    },
    async send(id: string) {
      await call(`/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, {
        method: "POST", body: JSON.stringify({ send_to_invoicer: true, send_to_recipient: true }),
      });
      return summary(await call(`/v2/invoicing/invoices/${encodeURIComponent(id)}`));
    },
    async status(id: string): Promise<InvoiceStatus> {
      return summary(await call(`/v2/invoicing/invoices/${encodeURIComponent(id)}`));
    },
    async list(): Promise<InvoiceStatus[]> {
      const page = await call("/v2/invoicing/invoices?page=1&page_size=20&total_required=true");
      return (page.items ?? []).map(summary);
    },
  };
}
