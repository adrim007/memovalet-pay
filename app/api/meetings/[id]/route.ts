import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateMeetingNotes, updateMeetingTitle } from "@/lib/database";

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
    if (Object.prototype.hasOwnProperty.call(body, "projectId")) {
      const projectId = body.projectId;
      if (projectId !== null && typeof projectId !== "string") return NextResponse.json({ error: "Invalid project" }, { status: 400 });
      if (projectId) {
        const project = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
        if (project.error || !project.data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const updated = await supabase.from("meetings").update({ project_id: projectId }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
      if (updated.error || !updated.data) return NextResponse.json({ error: "Only the meeting owner can move it to a project" }, { status: 403 });
      return NextResponse.json({ projectId });
    }

    if (typeof body.notes === "string") {
      const ok = await updateMeetingNotes(id, body.notes);
      if (!ok) {
        return NextResponse.json({ error: "Couldn't save notes" }, { status: 500 });
      }
      return NextResponse.json({ notes: body.notes });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "Title can't be empty" }, { status: 400 });
    }

    const ok = await updateMeetingTitle(id, title);

    if (!ok) {
      return NextResponse.json({ error: "Couldn't rename that meeting" }, { status: 500 });
    }

    return NextResponse.json({ title });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error updating meeting" }, { status: 500 });
  }
}
