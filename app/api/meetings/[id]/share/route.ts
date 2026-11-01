import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const existing = await supabase.from("meetings").select("share_token").eq("id", id).single();

    if (existing.error || !existing.data) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    let token = existing.data.share_token;

    if (!token) {
      token = randomUUID().replace(/-/g, "");

      const update = await supabase.from("meetings").update({ share_token: token }).eq("id", id);

      if (update.error) {
        return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
      }
    }

    const origin = new URL(req.url).origin;
    return NextResponse.json({ url: origin + "/share/" + token });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}
