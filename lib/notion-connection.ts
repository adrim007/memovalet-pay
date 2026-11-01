import { createServiceClient } from "@/lib/supabase/service";

export const NOTION_VERSION = "2022-06-28";

/** MemoValet's own Notion app is registered, so people can connect. */
export function notionConfigured() {
  return Boolean(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET);
}

export interface NotionConnection {
  access_token: string;
  workspace_name: string;
  parent_page_id: string | null;
  parent_page_title: string | null;
}

export async function getNotionConnection(userId: string): Promise<NotionConnection | null> {
  try {
    const { data, error } = await createServiceClient()
      .from("notion_connections")
      .select("access_token,workspace_name,parent_page_id,parent_page_title")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export function notionRequest(token: string, path: string, init: { method?: string; body?: unknown } = {}) {
  return fetch("https://api.notion.com/v1" + path, {
    method: init.method || "GET",
    headers: {
      Authorization: "Bearer " + token,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}

interface NotionPageResult {
  id: string;
  parent?: { type?: string };
  properties?: Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>;
}

function titleOf(page: NotionPageResult): string {
  for (const property of Object.values(page.properties || {})) {
    if (property.type === "title") {
      const text = (property.title || []).map((part) => part.plain_text || "").join("").trim();
      if (text) return text;
    }
  }
  return "Untitled";
}

/**
 * The page meeting notes are saved inside. Notion lets people pick which pages
 * to share while connecting; a top-level page is preferred over one nested in a
 * database, most recently edited first. Null when nothing was shared.
 */
export async function pickParentPage(token: string): Promise<{ id: string; title: string } | null> {
  const response = await notionRequest(token, "/search", {
    method: "POST",
    body: {
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: 25,
    },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { results?: NotionPageResult[] };
  const pages = data.results || [];
  const chosen = pages.find((page) => page.parent?.type === "workspace") || pages[0];
  return chosen ? { id: chosen.id, title: titleOf(chosen) } : null;
}

/** Notion refuses a token whose integration was removed: stop pretending it's connected. */
export async function forgetNotionConnection(userId: string, token: string) {
  try {
    await createServiceClient()
      .from("notion_connections")
      .delete()
      .eq("user_id", userId)
      .eq("access_token", token);
  } catch (err) {
    console.error("Couldn't clear a revoked Notion connection", err);
  }
}
