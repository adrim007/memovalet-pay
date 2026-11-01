import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDocument, listDocuments } from "@/lib/database";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const documents = await listDocuments(user.id);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error fetching documents" }, { status: 500 });
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
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const filePath = typeof body.filePath === "string" ? body.filePath : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : null;
    const folderId = typeof body.folderId === "string" ? body.folderId : null;

    if (!title || !filePath) {
      return NextResponse.json({ error: "Missing document details" }, { status: 400 });
    }

    if (!filePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const document = await createDocument({ userId: user.id, title, filePath, mimeType, folderId });

    if (!document) {
      return NextResponse.json({ error: "Couldn't save that document" }, { status: 500 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error saving document" }, { status: 500 });
  }
}
