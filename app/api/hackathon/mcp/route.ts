import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleMcp, noMcpStream, prepareFollowThrough } from "@/lib/mcp/follow-through-server";
import { bookFollowUp, demoMeetingMemory, draftTaskReminders, followUpTimes, getDecisionContext, listOpenActionItems, searchMeetingMemory } from "@/lib/hackathon/meeting-memory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function content(value: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value };
}
export async function POST(request: Request) {
  // Like the assistant that uses it, this sample server is off in production.
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRODUCT_PREVIEW !== "1") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const server = new McpServer({ name: "memovalet-meeting-memory-sample", version: "2.0.0" });
  const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  server.registerTool("search_meeting_memory", {
    description: "Search recorded decisions in the fictional sample workspace and return their sources.",
    inputSchema: { query: z.string().trim().min(1).max(2000) }, annotations,
  }, async ({ query }) => content({ results: searchMeetingMemory(query) }));
  server.registerTool("list_open_action_items", {
    description: "Read unfinished actions in the fictional sample workspace.", inputSchema: {}, annotations,
  }, async () => content({ actionItems: listOpenActionItems() }));
  server.registerTool("get_decision_context", {
    description: "Read a fictional decision, its reason and related open actions.",
    inputSchema: { decisionId: z.enum(["launch-date", "pricing-copy"]) }, annotations,
  }, async ({ decisionId }) => content(getDecisionContext(decisionId)!));
  server.registerTool("prepare_follow_through", {
    description: "Prepare a sourced follow up plan from a fictional meeting, flag missing task details, and retain completed work. Saves nothing.",
    inputSchema: { decisionId: z.enum(["launch-date", "pricing-copy"]) }, annotations,
  }, async ({ decisionId }) => {
    const decision = demoMeetingMemory.decisions.find(row => row.id === decisionId)!;
    const plan = prepareFollowThrough({
      meeting: { id: decision.id, title: decision.meeting },
      tasks: demoMeetingMemory.actionItems.filter(row => row.meeting === decision.meeting).map(row => ({
        id: row.id, task: row.task, owner: row.owner, due_date: row.due, status: row.status === "done" ? "done" : "todo",
      })),
    });
    return content({ ...plan, source: { ...plan.source, href: `/preview/history/${decision.id}?scenario=launch` }, sample: true });
  });
  const decisionId = z.enum(["launch-date", "pricing-copy"]);
  server.registerTool("find_follow_up_times", {
    description: "Suggest three 30 minute follow up slots for a fictional meeting's team, after its open tasks are due. Read only.",
    inputSchema: { decisionId }, annotations,
  }, async ({ decisionId }) => content(followUpTimes(decisionId)!));
  server.registerTool("book_follow_up", {
    description: "Book the follow up meeting at one of the slots from find_follow_up_times. Only call this after the user has explicitly confirmed that exact time. Returns the booking for the client to save (this sample server keeps no state) and sends no invitations.",
    inputSchema: { decisionId, start: z.string().describe("The exact start value of the chosen slot from find_follow_up_times.") },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ decisionId, start }) => {
    const booked = bookFollowUp(decisionId, start);
    if (!booked) return { content: [{ type: "text" as const, text: "That time is not one of the offered slots. Call find_follow_up_times and use an exact start value." }], isError: true };
    return content(booked);
  });
  server.registerTool("draft_task_reminders", {
    description: "Draft short reminder messages for each open task owner of a fictional meeting, optionally mentioning the booked follow up. Drafts only; nothing is sent.",
    inputSchema: { decisionId, followUpStart: z.string().optional().describe("The booked follow up start, if there is one.") }, annotations,
  }, async ({ decisionId, followUpStart }) => content(draftTaskReminders(decisionId, followUpStart)!));
  return handleMcp(request, server);
}
export const GET = noMcpStream;
export const DELETE = noMcpStream;

