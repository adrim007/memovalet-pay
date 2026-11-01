import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export type FollowThroughSnapshot = {
  meeting: { id: string; title: string };
  tasks: { id: string; task: string; owner: string | null; due_date: string | null; status: string }[];
};
export type FollowThroughPlan = {
  source: { id: string; title: string; href: string };
  openTasks: FollowThroughSnapshot["tasks"];
  completedCount: number;
  missingOwners: string[];
  missingDeadlines: string[];
  followUp: { title: string; durationMinutes: number };
  reviewRequired: true;
};
export function prepareFollowThrough(snapshot: FollowThroughSnapshot): FollowThroughPlan {
  const openTasks = snapshot.tasks.filter(task => task.status !== "done");
  return {
    source: { ...snapshot.meeting, href: `/history/${encodeURIComponent(snapshot.meeting.id)}` },
    openTasks, completedCount: snapshot.tasks.length - openTasks.length,
    missingOwners: openTasks.filter(task => !task.owner?.trim()).map(task => task.id),
    missingDeadlines: openTasks.filter(task => {
      const date = task.due_date;
      return !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date + "T12:00:00Z")) ||
        new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date;
    }).map(task => task.id),
    followUp: { title: `Follow up: ${snapshot.meeting.title}`.slice(0, 200), durationMinutes: 30 },
    reviewRequired: true,
  };
}
export function createFollowThroughServer(load: () => Promise<FollowThroughSnapshot>, sample = false) {
  const server = new McpServer({ name: "memovalet-follow-through", version: "1.0.0" });
  server.registerTool("prepare_follow_through", {
    description: `Read ${sample ? "fictional sample" : "the signed-in owner's saved"} meeting tasks. Prepare a sourced review plan, flag missing owners/deadlines, preserve completed tasks. Does not save or send anything.`,
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const plan = prepareFollowThrough(await load());
    return { content: [{ type: "text" as const, text: JSON.stringify(plan) }], structuredContent: plan };
  });
  return server;
}

export function mcpOriginAllowed(request: Request) {
  const url = new URL(request.url);
  const allowedHosts = ["localhost", "127.0.0.1", "[::1]", "memovalet.com", "www.memovalet.com"];
  if (!allowedHosts.includes(url.hostname)) return false;
  const origin = request.headers.get("origin");
  return (!origin || origin === url.origin) && request.headers.get("sec-fetch-site") !== "cross-site";
}
export async function handleMcp(request: Request, server: McpServer) {
  if (!mcpOriginAllowed(request)) {
    await server.close();
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, { status: response.status, headers });
  } finally { await server.close(); }
}
export function noMcpStream() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

