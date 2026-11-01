import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNote, listNotes } from "@/lib/database";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const notes = await listNotes();
    return NextResponse.json({ notes });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const bodyText = typeof body.body === "string" ? body.body.trim() : "";

    if (!bodyText) {
      return NextResponse.json({ error: "Note can't be empty" }, { status: 400 });
    }

    const note = await createNote({
      userId: user.id,
      title: typeof body.title === "string" ? body.title.trim() : null,
      body: bodyText,
    });

    if (!note) {
      return NextResponse.json({ error: "Couldn't save that note" }, { status: 500 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
