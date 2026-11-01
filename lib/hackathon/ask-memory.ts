// This adapter powers the local sample workspace, using real HTTP tool calls.
// The normal Ask page continues to use its authenticated /api/ask endpoint.

// Shows a stored YYYY MM DD date in words ("20 October"), so answers carry no dashes.
const inWords = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
  ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" })
  : date;

export async function askSampleMemory(question: string) {
  async function rpc(method: string, params?: Record<string, unknown>) {
    const response = await fetch("/api/hackathon/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25" },
      body: JSON.stringify({ jsonrpc: "2.0", ...(method.startsWith("notifications/") ? {} : { id: crypto.randomUUID() }), method, params }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Meeting memory unavailable");
    if (response.status === 202) return null;
    const reply = await response.json();
    if (reply.error || reply.result?.isError) throw new Error("Meeting memory returned an error");
    return reply.result;
  }

  const q = question.toLowerCase();
  const prepareQuery = /\b(prepare|follow[\s-]?up|next steps)\b/.test(q);
  const actionQuery = /\b(open|unfinished|outstanding|actions|tasks|owe)\b/.test(q);
  const contextQuery = /\b(why|reason|context|smaller)\b/.test(q);
  if (!prepareQuery && !actionQuery && !contextQuery && !/\b(launch|pilot|decid|decision|pricing)\w*/.test(q)) {
    return { answer: "This sample workspace contains the launch decision, its context, and open actions. Ask about one of those to see the meeting source.", sources: [], sourceLinks: {}, itemsSearched: 0, meetingsSearched: 0 };
  }
  await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "MemoValet Ask sample workspace", version: "1.0.0" } });
  await rpc("notifications/initialized");
  await rpc("tools/list");
  const result = await rpc("tools/call", {
    name: prepareQuery ? "prepare_follow_through" : actionQuery ? "list_open_action_items" : contextQuery ? "get_decision_context" : "search_meeting_memory",
    arguments: prepareQuery ? { decisionId: q.includes("pricing") ? "pricing-copy" : "launch-date" } : actionQuery ? {} : contextQuery ? { decisionId: "launch-date" } : { query: q.includes("pricing") ? "pricing" : "launch" },
  });
  const text = result?.content?.find((block: { type: string }) => block.type === "text")?.text;
  if (typeof text !== "string") throw new Error("No meeting source returned");
  const payload = JSON.parse(text);
  let answer: string;
  let meetings: string[];
  if (prepareQuery) {
    if (!Array.isArray(payload.openTasks) || payload.reviewRequired !== true || !payload.source?.title) throw new Error("Invalid follow-up plan");
    answer = "Prepared from the saved meeting: " + payload.source.title + ".\n\n" +
      payload.openTasks.map((task: { owner: string | null; task: string; due_date: string | null }) =>
        (task.owner || "Owner needed") + ": " + task.task + " Due: " + (task.due_date ? inWords(task.due_date) : "choose a date") + ".").join("\n\n") +
      "\n\nSuggested meeting: " + payload.followUp.title + " (" + payload.followUp.durationMinutes + " minutes)." +
      "\n\nReview the source, then choose a date and time in Create. Nothing has been saved or sent.";
    meetings = [payload.source.title];
  } else if (actionQuery) {
    if (!Array.isArray(payload.actionItems)) throw new Error("Invalid action response");
    answer = payload.actionItems.map((a: { owner: string; task: string; due: string }) => `${a.owner}: ${a.task} Due ${inWords(a.due)}.`).join("\n\n") || "No unfinished actions were found.";
    meetings = payload.actionItems.map((a: { meeting: string }) => a.meeting);
  } else if (contextQuery) {
    if (typeof payload.decision !== "string" || typeof payload.context !== "string") throw new Error("Invalid decision response");
    answer = `${payload.decision}\n\n${payload.context}`;
    meetings = [payload.meeting];
  } else {
    if (!Array.isArray(payload.results)) throw new Error("Invalid search response");
    answer = payload.results.map((r: { decision: string }) => r.decision).join("\n\n") || "No matching decision was found.";
    meetings = payload.results.map((r: { meeting: string }) => r.meeting);
  }
  const sources = [...new Set(meetings)].map(meeting => `Meeting: ${meeting}`);
  return {
    answer,
    sources,
    sourceLinks: Object.fromEntries(sources.map(label => [label, label.includes("Acme") ? "/preview/history/launch-date?scenario=launch" : "/preview/history/pricing-copy?scenario=launch"])),
    itemsSearched: prepareQuery ? payload.openTasks.length : actionQuery ? payload.actionItems.length : contextQuery ? 1 : payload.results.length,
    meetingsSearched: new Set(meetings).size,
  };
}
