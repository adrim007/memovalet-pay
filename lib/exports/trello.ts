import { MeetingResult, TrelloCard } from "../types";
import { forgetTrelloConnection, getTrelloConnection, trelloUrl } from "../trello-connection";

/** One card per action item, in the list this person chose in Settings. */
export async function createTrelloCards(result: MeetingResult, userId: string): Promise<TrelloCard[]> {
  const connection = await getTrelloConnection(userId);
  if (!connection?.list_id) {
    throw new Error("Connect Trello in Settings and choose a list first.");
  }

  const meetingTitle = (result.metadata && result.metadata.title) || "";
  const actionItems = result.action_items || [];
  const cards: TrelloCard[] = [];

  for (const item of actionItems) {
    const desc = [
      item.owner ? "Owner: " + item.owner : "",
      item.due_date ? "Due: " + item.due_date : "",
      meetingTitle ? "From: " + meetingTitle : "",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(
      trelloUrl("/cards", connection.token, { idList: connection.list_id, name: item.task.slice(0, 16384), desc }),
      { method: "POST" }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // They revoked MemoValet in Trello: stop showing it as connected.
      if (response.status === 401) await forgetTrelloConnection(userId, connection.token);
      throw new Error("Failed to create Trello card: " + response.status);
    }

    cards.push({ name: data.name, url: data.shortUrl || data.url });
  }

  return cards;
}
