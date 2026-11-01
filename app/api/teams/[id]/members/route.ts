import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listTeamMembers } from "@/lib/database";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const members = await listTeamMembers(id);
    return NextResponse.json({ members });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error loading members" }, { status: 500 });
  }
}
