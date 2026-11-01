import { approve, APPROVAL_MINUTES } from "@/lib/paypal/approval";
import { proposeInvoice } from "@/lib/paypal/invoice-flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Called only by the Approve tap on the invoice card in this app's own page. It is not an MCP
// tool, so the AI cannot approve its own invoice. This demo has no sign in, so a real product
// would also tie the approval to a signed in owner.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRODUCT_PREVIEW !== "1") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Approvals can only come from the MemoValet page." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { proposalId?: unknown; draft?: unknown; runId?: unknown } | null;
  const runId = typeof body?.runId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.runId) ? body.runId : "";
  if (!runId) return Response.json({ error: "This page needs a refresh before it can approve." }, { status: 400 });
  const proposal = proposeInvoice();
  // The tap sends back everything the card showed; if any of it changed since, nothing is approved.
  if (body?.proposalId !== proposal.proposalId || JSON.stringify(body?.draft) !== JSON.stringify(proposal.draft)) {
    return Response.json({ error: "This invoice changed since it was shown. Refresh and check it again." }, { status: 409 });
  }
  return Response.json({ approvalToken: approve(proposal.proposalId, proposal.draft, Date.now(), runId), expiresInMinutes: APPROVAL_MINUTES });
}
