import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2 || q.length > 160) return NextResponse.json({ results: [] });
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    // PostgREST filter separators are not part of the user's literal search.
    const term = q.replace(/[%,()."\\\r\n]/g, " ").replace(/\s+/g, " ").trim();
    if (!term) return NextResponse.json({ results: [] });
    const pattern = `%${term}%`;
    const [meetings, documents, notes] = await Promise.all([
      supabase.from("meetings").select("id,title,created_at").or(`title.ilike.${pattern},summary.ilike.${pattern},notes.ilike.${pattern}`).order("created_at", { ascending: false }).limit(8),
      supabase.from("documents").select("id,title,created_at").eq("user_id", user.id).or(`title.ilike.${pattern},notes.ilike.${pattern}`).order("created_at", { ascending: false }).limit(8),
      supabase.from("notes").select("id,title,created_at").eq("user_id", user.id).or(`title.ilike.${pattern},body.ilike.${pattern}`).order("created_at", { ascending: false }).limit(8),
    ]);
    if (meetings.error || documents.error || notes.error) {
      return NextResponse.json({ error: "Search is temporarily unavailable. Please try again." }, { status: 503 });
    }
    const results = [
      ...(meetings.data || []).map(row => ({ ...row, kind: "Meeting", href: `/history/${row.id}` })),
      ...(documents.data || []).map(row => ({ ...row, kind: "Document", href: `/documents?document=${row.id}` })),
      ...(notes.data || []).map(row => ({ ...row, title: row.title || "Untitled note", kind: "Note", href: `/notes#note-${encodeURIComponent(row.id)}` })),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Search is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
