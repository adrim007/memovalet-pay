import { featureError } from "@/lib/plan-access";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTeam, listUserTeams } from "@/lib/database";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const teams = await listUserTeams(user.id);

    return NextResponse.json({ teams });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error fetching teams" }, { status: 500 });
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

    const denied = await featureError(user.id, "shared_work");
    if (denied) return NextResponse.json({ error: denied }, { status: 402 });
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const team = await createTeam(user.id, name);

    if (!team) {
      return NextResponse.json({ error: "Couldn't create that group" }, { status: 500 });
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error creating group" }, { status: 500 });
  }
}
