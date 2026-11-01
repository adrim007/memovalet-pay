import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFolder, listFolders } from "@/lib/database";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const folders = await listFolders(user.id);
    return NextResponse.json({ folders });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error fetching folders" }, { status: 500 });
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const parentId = typeof body.parentId === "string" ? body.parentId : null;

    if (!name) {
      return NextResponse.json({ error: "Folder needs a name" }, { status: 400 });
    }

    const folder = await createFolder({ userId: user.id, name, parentId });

    if (!folder) {
      return NextResponse.json({ error: "Couldn't create that folder" }, { status: 500 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error creating folder" }, { status: 500 });
  }
}
