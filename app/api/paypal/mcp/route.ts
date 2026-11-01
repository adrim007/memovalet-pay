import { handleMcp, noMcpStream } from "@/lib/mcp/follow-through-server";
import { buildPayServer } from "@/lib/paypal/mcp-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRODUCT_PREVIEW !== "1") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return handleMcp(request, buildPayServer());
}
export const GET = noMcpStream;
export const DELETE = noMcpStream;
