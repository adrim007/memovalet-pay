import { getGoogleAccessTokenForUser } from "../google/tokens";
import { MeetingResult } from "../types";

function buildDocContent(result: MeetingResult) {
  const lines: string[] = [];

  lines.push("Meeting Summary");
  lines.push("");
  lines.push(result.meeting_summary || "");
  lines.push("");

  lines.push("Key Decisions");
  const decisions = result.key_decisions || [];
  decisions.forEach(function (decision: string) {
    lines.push("- " + decision);
  });
  lines.push("");

  lines.push("Action Items");
  const actionItems = result.action_items || [];
  actionItems.forEach(function (item) {
    const owner = item.owner ? " (" + item.owner + ")" : "";
    lines.push("- " + item.task + owner);
  });
  lines.push("");

  lines.push("Follow Up Email");
  lines.push((result.follow_up_email && result.follow_up_email.body) || "");

  return lines.join("\n");
}

export async function exportToGoogleDocs(result: MeetingResult, userId: string): Promise<string> {
  const accessToken = await getGoogleAccessTokenForUser(userId);

  const createResponse = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: (result.metadata && result.metadata.title) || "Meeting Notes",
    }),
  });

  const doc = await createResponse.json();

  if (!createResponse.ok) {
    throw new Error("Failed to create Google Doc: " + JSON.stringify(doc));
  }

  const content = buildDocContent(result);

  const updateResponse = await fetch(
    "https://docs.googleapis.com/v1/documents/" + doc.documentId + ":batchUpdate",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content,
            },
          },
        ],
      }),
    }
  );

  if (!updateResponse.ok) {
    const err = await updateResponse.json();
    throw new Error("Failed to write Google Doc content: " + JSON.stringify(err));
  }

  return "https://docs.google.com/document/d/" + doc.documentId + "/edit";
}
