import { featureError } from "@/lib/plan-access";
import { explicitSchedule, parseSchedule } from "@/lib/schedule-text";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProject, listUserProjects } from "@/lib/database";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const projects = await listUserProjects();

    return NextResponse.json({ projects });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error fetching projects" }, { status: 500 });
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

    const denied = await featureError(user.id, "projects");
    if (denied) return NextResponse.json({ error: denied }, { status: 402 });
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
    const teamId = typeof body.teamId === "string" && body.teamId ? body.teamId : null;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    let schedule;
    try {
      schedule = body.dueDate ? explicitSchedule(body.dueDate, body.dueTime, body.timeZone) : typeof body.timeZone === "string" ? parseSchedule(name, body.timeZone) : null;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Please check the date and time." }, { status: 400 });
    }

    const project = await createProject({
      userId: user.id,
      name,
      clientName: clientName || null,
      dueDate: schedule?.date,
      dueAt: schedule?.at,
      timeZone: schedule?.timeZone,
      teamId,
    });

    if (!project) {
      return NextResponse.json({ error: "Couldn't create that project" }, { status: 500 });
    }

    return NextResponse.json({ project, schedule });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error creating project" }, { status: 500 });
  }
}
