import { MeetingResult } from "../types";
import { getSlackConnection, isSlackWebhook } from "../slack-connection";

export async function postToSlack(result: MeetingResult, userId: string): Promise<boolean> {
  const connection = await getSlackConnection(userId);
  const webhookUrl = connection?.webhook_url;
  if (!isSlackWebhook(webhookUrl)) throw new Error("Connect your Slack channel in Settings first.");
  const title = (result.metadata && result.metadata.title) || "Meeting Notes";

  const decisionLines = (result.key_decisions || []).map(function (d) {
    return "• " + d;
  });

  const actionLines = (result.action_items || []).map(function (item) {
    const owner = item.owner ? " (" + item.owner + ")" : "";
    const due = item.due_date ? " (due " + item.due_date + ")" : "";
    return "• " + item.task + owner + due;
  });

  const blocks = [
    { type: "header", text: { type: "plain_text", text: title } },
    { type: "section", text: { type: "mrkdwn", text: result.meeting_summary || "" } },
  ];

  if (decisionLines.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*Key Decisions*\n" + decisionLines.join("\n") },
    });
  }

  if (actionLines.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*Action Items*\n" + actionLines.join("\n") },
    });
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Failed to post to Slack: " + text);
  }

  return true;
}
