import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { explicitSchedule, reminderInstant } from "@/lib/schedule-text";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    try {
      if ("status" in body) {
        if (!["pending", "completed", "cancelled"].includes(body.status)) throw new Error("Invalid status");
        patch.status = body.status;
        patch.completed_at = body.status === "completed" ? new Date().toISOString() : null;
      }
      if ("description" in body) {
        if (typeof body.description !== "string" || !body.description.trim() || body.description.length > 2000) throw new Error("Enter a task description of up to 2,000 characters.");
        patch.description = body.description.trim();
      }
      if ("personName" in body) {
        if (body.personName !== null && (typeof body.personName !== "string" || body.personName.length > 200)) throw new Error("Please check the person's name.");
        patch.person_name = body.personName?.trim() || null;
      }
      if ("reminderLocal" in body) patch.reminder_at = reminderInstant(body.reminderLocal, body.timeZone);
      if ("dueDate" in body) {
        const schedule = explicitSchedule(body.dueDate, body.dueTime, body.timeZone);
        patch.due_date = schedule?.date ?? null;
        patch.due_at = schedule?.at ?? null;
        patch.time_zone = schedule?.timeZone ?? null;
      }
      if (!Object.keys(patch).length) throw new Error("No changes to save.");
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Please check your changes." }, { status: 400 });
    }
    const { data, error } = await supabase.from("commitments").update(patch).eq("id", id).eq("user_id", user.id).select().maybeSingle();
    if (error) return NextResponse.json({ error: "Couldn't save your changes. Please try again." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "This task is no longer available." }, { status: 404 });
    return NextResponse.json({ commitment: data, status: data.status });
  } catch {
    return NextResponse.json({ error: "Couldn't save your changes. Please try again." }, { status: 500 });
  }
}
