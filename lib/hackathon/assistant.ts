import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { assistantProvider, runModelTurn, withoutDashes, type CallTool, type McpTool } from "@/lib/ai/toolLoop";

export { AssistantProviderError, withoutDashes } from "@/lib/ai/toolLoop";

// The simulated Alexa+ assistant for the hackathon sample workspace. The model plans the
// conversation; every fact and every action goes through MemoValet's MCP server, which this
// module reaches as an ordinary MCP client over Streamable HTTP. It runs on Gemini when a
// GEMINI_API_KEY is set (Google's free tier works) and on Claude otherwise, like lib/ai/provider.

const SYSTEM = `You are Alexa+, using the MemoValet skill on a smart display. MemoValet keeps a team's meetings, decisions and tasks, and you help the user follow through on them.

This is a fictional sample workspace for a demo. The user is Maya. Today is Saturday 17 October 2026, 9 am in Melbourne.

How to work:
* Use the MemoValet tools for every fact about meetings, tasks and times. Never invent them.
* When the user wants to follow up on a meeting, call prepare_follow_through and then find_follow_up_times, then offer the times.
* Only call book_follow_up when the user's latest message clearly confirms one exact offered time. Otherwise offer the times and ask which one.
* After booking, call draft_task_reminders with the booked start, and say the reminders are drafted but not sent.
* The launch planning meeting is decisionId "launch-date". The weekly product check in is "pricing-copy".

How to talk (your words are spoken aloud, and cards on the screen show the details):
* Sound like a warm, natural Australian assistant chatting with a colleague. Use everyday words and contractions like I've, it's and here's. Never sound formal: no "I have prepared", "please note" or "as requested".
* Reply in one to three short sentences, under 30 words in total. No lists, markdown, emoji or tool names.
* Don't read out the tasks or the times; the cards show them. Mention the one thing that matters, then the next step.
* Never use any dash character. Say dates like Thursday 22 October and times like 10 am. Once the day is clear, "Thursday at 10 am" is enough.
* Examples of the tone (always use the real details from the tools):
  "Priya and Alex still have two tasks open, so I've found three times after they're due. Which one suits you?"
  "All done. Your launch follow up is booked for Thursday at 10 am. I've drafted reminders for Priya and Alex, but haven't sent them."
  "Two tasks are still open from the launch meeting, one for Priya and one for Alex. Want me to set up a follow up?"`;

const NOT_CONFIRMED = "Not booked. The user hasn't clearly chosen one of the times they were shown. Ask which time they want.";

type Slot = { start: string; label: string };

// The approval gate's reading of the user's latest message. A tapped time approves exactly that time.
// Spoken or typed approval must pick out one offered time: by day and time ("Thursday at 10 am"), by a
// detail only one time has ("3 pm", "Friday"), or by order ("the second one"), and it must not be a
// refusal. Anything else approves nothing, and the assistant asks again.
const REFUSAL = /\b(no|nope|not|don['’]?t|do not|never|cancel|stop|wait|hold off|rather not)\b/i;
const ORDER = [/\b(first|1st|earliest)\b/i, /\b(second|2nd|middle)\b/i, /\b(third|3rd|last|latest)\b/i];

function mentions(text: string, slot: Slot) {
  const [day, time = ""] = slot.label.split(" at "); // "Thursday 22 October", "10 am"
  const [weekday, date] = day.split(" ");
  const [hour, half = ""] = time.split(" ");
  const saysDay = new RegExp(`\\b(${weekday}|${date}(st|nd|rd|th)?)\\b`, "i").test(text);
  const clock = new RegExp(`\\b${hour}(?::00)?\\s*(a\\.?\\s?m\\b\\.?|p\\.?\\s?m\\b\\.?)?(?![\\d:])`, "i").exec(text);
  const saysTime = Boolean(clock) && (!clock![1] || clock![1][0].toLowerCase() === half[0]);
  return { saysDay, saysTime };
}

export function approvedSlot(text: string, offered: Slot[], tapped?: string): Slot | undefined {
  if (tapped) return offered.find(slot => slot.start === tapped);
  if (REFUSAL.test(text) || offered.length === 0) return undefined;
  const marks = offered.map(slot => ({ slot, ...mentions(text, slot) }));
  const anyDay = marks.some(mark => mark.saysDay), anyTime = marks.some(mark => mark.saysTime);
  if (anyDay || anyTime) {
    const fits = marks.filter(mark => (!anyDay || mark.saysDay) && (!anyTime || mark.saysTime));
    return fits.length === 1 ? fits[0].slot : undefined;
  }
  const order = ORDER.findIndex(pattern => pattern.test(text));
  return order >= 0 ? (order === 2 ? offered.at(-1) : offered[order]) : undefined;
}

export type AssistantCard = { tool: string; data: Record<string, unknown> };
export type AssistantTurn = { conversationId: string; reply: string; cards: AssistantCard[] };

// Each conversation also keeps the follow up times already shown to the user, and the booking once made,
// for the approval gate.
type Conversation = { provider: string; messages: unknown[]; offered: Slot[]; booked?: Slot; touched: number };
const conversations = new Map<string, Conversation>();
const KEEP_MS = 2 * 60 * 60 * 1000;

function remember(id: string, state: Omit<Conversation, "touched">) {
  const now = Date.now();
  for (const [key, value] of conversations) if (now - value.touched > KEEP_MS) conversations.delete(key);
  conversations.set(id, { ...state, touched: now });
}

export async function runAssistantTurn(options: {
  origin: string;
  conversationId?: string;
  text: string;
  confirmStart?: string; // the time the user tapped, if they tapped one
}): Promise<AssistantTurn> {
  const using = assistantProvider();
  const saved = options.conversationId ? conversations.get(options.conversationId) : undefined;
  const same = saved && saved.provider === using;
  const conversationId = same ? options.conversationId! : crypto.randomUUID();
  const history = same ? saved.messages : [];
  const shown = same ? saved.offered : [];
  const approved = approvedSlot(options.text, shown, options.confirmStart);
  const offeredNow: Slot[] = [];
  let booked = same ? saved.booked : undefined;

  const mcp = new Client({ name: "MemoValet Alexa+ simulation", version: "1.0.0" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL("/api/hackathon/mcp", options.origin)));
  try {
    const cards: AssistantCard[] = [];
    const tools = (await mcp.listTools()).tools as McpTool[];
    const callTool: CallTool = async (name, args) => {
      // Approval gate, enforced here rather than left to the model: a booking only goes through for the one
      // time this message chose from times shown in an earlier turn, and only once per conversation.
      if (name === "book_follow_up") {
        const start = typeof args.start === "string" ? args.start : "";
        if (booked) return { text: `Not booked again. ${booked.label} is already booked in this conversation.`, isError: true };
        if (!approved) return { text: NOT_CONFIRMED, isError: true };
        if (start !== approved.start) return { text: `Not booked. The user chose ${approved.label}, so book exactly start ${approved.start}.`, isError: true };
      }
      const result = await mcp.callTool({ name, arguments: args }, undefined, { timeout: 15000 });
      const data = result.structuredContent as Record<string, unknown> | undefined;
      if (!result.isError && data) {
        cards.push({ tool: name, data });
        if (name === "book_follow_up") booked = approved;
        if (name === "find_follow_up_times") {
          for (const slot of (data.slots as Partial<Slot>[] | undefined) ?? []) {
            if (typeof slot.start === "string" && typeof slot.label === "string") offeredNow.push({ start: slot.start, label: slot.label });
          }
        }
      }
      const text = (result.content as { type: string; text?: string }[] | undefined)?.find(block => block.type === "text")?.text;
      return { text: text ?? JSON.stringify(data ?? {}), data, isError: Boolean(result.isError) };
    };

    const turn = await runModelTurn(using, SYSTEM, history, options.text, tools, callTool);
    const offered = [...shown, ...offeredNow.filter(slot => !shown.some(seen => seen.start === slot.start))];
    remember(conversationId, { provider: using, messages: turn.messages, offered, booked });
    return { conversationId, reply: withoutDashes(turn.reply || "Done. The details are on the screen."), cards };
  } finally {
    await mcp.close();
  }
}
