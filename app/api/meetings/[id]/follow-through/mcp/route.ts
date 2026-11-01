import { createClient } from "@/lib/supabase/server";
import { createFollowThroughServer, handleMcp, mcpOriginAllowed, noMcpStream } from "@/lib/mcp/follow-through-server";
import { GET as readFollowThrough } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // Still in preview, like the follow through panel.
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRODUCT_PREVIEW !== "1") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (!mcpOriginAllowed(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const server = createFollowThroughServer(async () => {
    const result = await readFollowThrough(request, context);
    if (!result || !result.ok) throw new Error("This meeting's saved tasks are unavailable or you are not its owner.");
    return result.json();
  });
  return handleMcp(request, server);
}
export const GET = noMcpStream;
export const DELETE = noMcpStream;

