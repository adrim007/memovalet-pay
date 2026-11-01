import { createServiceClient } from "@/lib/supabase/service";

/** MemoValet's own Trello app key is set, so people can connect. */
export function trelloConfigured() {
  return Boolean(process.env.TRELLO_API_KEY);
}

export interface TrelloConnection {
  token: string;
  member_name: string;
  board_name: string | null;
  list_id: string | null;
  list_name: string | null;
}

export async function getTrelloConnection(userId: string): Promise<TrelloConnection | null> {
  try {
    const { data, error } = await createServiceClient()
      .from("trello_connections")
      .select("token,member_name,board_name,list_id,list_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/** Trello wants the app key and the person's token on every call. */
export function trelloUrl(path: string, token: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ ...params, key: process.env.TRELLO_API_KEY || "", token });
  return "https://api.trello.com/1" + path + "?" + query.toString();
}

// Trello tokens are long alphanumeric strings; anything else is refused before
// it's sent anywhere or stored.
export function looksLikeTrelloToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9]{32,200}$/.test(value);
}

/** Trello refuses a token that was revoked: stop pretending it's connected. */
export async function forgetTrelloConnection(userId: string, token: string) {
  try {
    await createServiceClient().from("trello_connections").delete().eq("user_id", userId).eq("token", token);
  } catch (err) {
    console.error("Couldn't clear a revoked Trello connection", err);
  }
}
