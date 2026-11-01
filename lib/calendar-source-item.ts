import { createClient } from "@/lib/supabase/server";

// A calendar link can point beyond the first page of a Library list. Fetch
// that exact item under the same user/RLS context instead of dropping it.
export async function calendarSourceItem(table: "notes" | "documents" | "action_items", id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Couldn't reopen this item. Please try again.");
  return data;
}
