import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProject, listProjectMeetings, updateProjectStatus } from "@/lib/database";

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

    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const meetings = await listProjectMeetings(id);

    return NextResponse.json({ project, meetings });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error fetching project" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const status = body.status === "closed" ? "closed" : body.status === "active" ? "active" : null;

    if (!status) {
      return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
    }

    const ok = await updateProjectStatus(id, status);

    if (!ok) {
      return NextResponse.json({ error: "Couldn't update that project" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error updating project" }, { status: 500 });
  }
}
