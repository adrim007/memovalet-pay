import { MeetingResult } from "../types";
import { forgetNotionConnection, getNotionConnection, notionRequest } from "../notion-connection";

// Notion rejects a whole page if any single text run is over 2,000 characters,
// or a request carries more than 100 blocks. A long summary or follow-up email
// used to fail the entire export, so text is split into runs and blocks capped.
const MAX_RUN = 2000;
const MAX_BLOCKS = 100;

function richText(text: string) {
  const runs = [];
  for (let i = 0; i < text.length; i += MAX_RUN) {
    runs.push({ type: "text", text: { content: text.slice(i, i + MAX_RUN) } });
  }
  return runs.length ? runs.slice(0, 100) : [{ type: "text", text: { content: "" } }];
}

function heading(text: string) {
  return { object: "block", type: "heading_2", heading_2: { rich_text: richText(text) } };
}

function paragraph(text: string) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: richText(text) } };
}

function bullet(text: string) {
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(text) } };
}

export function buildChildren(result: MeetingResult) {
  const children = [];

  children.push(heading("Summary"));
  children.push(paragraph(result.meeting_summary || ""));

  const decisions = result.key_decisions || [];
  if (decisions.length > 0) {
    children.push(heading("Key Decisions"));
    decisions.forEach(function (d) {
      children.push(bullet(d));
    });
  }

  const actionItems = result.action_items || [];
  if (actionItems.length > 0) {
    children.push(heading("Action Items"));
    actionItems.forEach(function (item) {
      const owner = item.owner ? " (" + item.owner + ")" : "";
      const due = item.due_date ? " (due " + item.due_date + ")" : "";
      children.push(bullet(item.task + owner + due));
    });
  }

  if (result.follow_up_email && result.follow_up_email.body) {
    children.push(heading("Follow Up Email"));
    if (result.follow_up_email.subject) {
      children.push(paragraph(result.follow_up_email.subject));
    }
    children.push(paragraph(result.follow_up_email.body));
  }

  return children.slice(0, MAX_BLOCKS);
}

/** Saves the meeting as a page inside the page this person shared with MemoValet. */
export async function exportToNotion(result: MeetingResult, userId: string): Promise<string> {
  const connection = await getNotionConnection(userId);
  if (!connection?.parent_page_id) {
    throw new Error("Connect Notion in Settings and share a page with MemoValet first.");
  }
  const title = (result.metadata && result.metadata.title) || "Meeting Notes";

  const response = await notionRequest(connection.access_token, "/pages", {
    method: "POST",
    body: {
      parent: { page_id: connection.parent_page_id },
      properties: { title: { title: [{ text: { content: title.slice(0, MAX_RUN) } }] } },
      children: buildChildren(result),
    },
  });
  const data = await response.json();

  if (!response.ok) {
    // They removed MemoValet from their Notion: stop showing it as connected.
    if (response.status === 401) await forgetNotionConnection(userId, connection.access_token);
    throw new Error("Failed to create Notion page: " + (data.code || response.status));
  }

  return data.url;
}
