import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { acceptTeamInvite } from "@/lib/database";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const result = await acceptTeamInvite(token, user.id);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ teamId: result.teamId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error joining team" }, { status: 500 });
  }
}
