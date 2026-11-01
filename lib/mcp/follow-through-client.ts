import type { FollowThroughPlan } from "@/lib/mcp/follow-through-server";

// Loaded only when the user requests preparation. The server remains authoritative.
export async function requestFollowThroughPlan(meetingId: string): Promise<FollowThroughPlan> {
  const [{ Client }, { StreamableHTTPClientTransport }] = await Promise.all([
    import("@modelcontextprotocol/sdk/client/index.js"),
    import("@modelcontextprotocol/sdk/client/streamableHttp.js"),
  ]);
  const client = new Client({ name: "MemoValet meeting follow-through", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`/api/meetings/${encodeURIComponent(meetingId)}/follow-through/mcp`, window.location.origin),
    { requestInit: { credentials: "same-origin" } },
  );
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    if (!tools.tools.some(tool => tool.name === "prepare_follow_through")) throw new Error("Meeting preparation is unavailable.");
    const result = await client.callTool({ name: "prepare_follow_through", arguments: {} }, undefined, { timeout: 15000 });
    if (result.isError || !result.structuredContent) throw new Error("Couldn't prepare this meeting. Nothing was saved.");
    const plan = result.structuredContent as unknown as FollowThroughPlan;
    if (plan.source?.id !== meetingId || !Array.isArray(plan.openTasks) || plan.reviewRequired !== true ||
        typeof plan.followUp?.title !== "string" || plan.followUp.durationMinutes !== 30 ||
        !Array.isArray(plan.missingDeadlines) || !Array.isArray(plan.missingOwners)) {
      throw new Error("Meeting preparation returned invalid details. Nothing was saved.");
    }
    return plan;
  } finally { await client.close(); }
}

