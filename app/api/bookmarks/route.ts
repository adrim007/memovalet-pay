import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBookmark, listBookmarks } from "@/lib/database";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const bookmarks = await listBookmarks();
    return NextResponse.json({ bookmarks });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load bookmarks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    let url: URL;
    try {
      url = new URL(rawUrl.match(/^https?:\/\//i) ? rawUrl : "https://" + rawUrl);
    } catch {
      return NextResponse.json({ error: "That doesn't look like a link" }, { status: 400 });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return NextResponse.json({ error: "Only web links can be saved" }, { status: 400 });
    }

    const title =
      (typeof body.title === "string" && body.title.trim()) || url.hostname.replace(/^www\./, "");

    const bookmark = await createBookmark({ userId: user.id, title, url: url.toString() });
    if (!bookmark) {
      return NextResponse.json({ error: "Couldn't save that link" }, { status: 500 });
    }

    return NextResponse.json({ bookmark });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save bookmark" }, { status: 500 });
  }
}
