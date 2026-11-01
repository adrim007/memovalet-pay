import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { explicitSchedule } from "@/lib/schedule-text";
import { featureError } from "@/lib/plan-access";

type Context = { params: Promise<{ id: string }> };
const columns = "id,task,owner,due_date,status";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function ownedMeeting(id: string) {
  // Still in preview, like the panel that uses it.
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRODUCT_PREVIEW !== "1") {
    return { response: reply({ error: "Not found." }, 404) };
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: reply({ error: "Sign in required" }, 401) };
  const result = await supabase.from("meetings").select("id,title")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (result.error) return { response: reply({ error: "Couldn't load this meeting. Please retry." }, 500) };
  if (!result.data) return { response: reply({ error: "Meeting not found or you are not its owner." }, 404) };
  return { supabase, user, meeting: result.data };
}

export async function GET(_req: Request, { params }: Context) {
  try {
    const { id } = await params;
    const access = await ownedMeeting(id);
    if ("response" in access) return access.response;
    const { supabase, user, meeting } = access;
    const result = await supabase.from("action_items").select(columns)
      .eq("meeting_id", id).eq("user_id", user.id).order("created_at").limit(501);
    if (result.error) return reply({ error: "Couldn't load the saved tasks. Please retry." }, 500);
    if ((result.data?.length ?? 0) > 500) return reply({ error: "This meeting has too many tasks for this view. Open Tasks instead." }, 422);
    return reply({ meeting, tasks: result.data ?? [] });
  } catch {
    return reply({ error: "Couldn't load follow-through. Please retry." }, 500);
  }
}

export async function POST(req: Request, { params }: Context) {
  try {
    const origin = req.headers.get("origin");
    if ((origin && origin !== new URL(req.url).origin) || req.headers.get("sec-fetch-site") === "cross-site") {
      return reply({ error: "Please save from MemoValet." }, 403);
    }
    const { id } = await params;
    const access = await ownedMeeting(id);
    if ("response" in access) return access.response;
    const { supabase, user } = access;
    let body;
    try { body = await req.json(); } catch { return reply({ error: "Invalid request." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Invalid request." }, 400);
    if (body.confirmed !== true) return reply({ error: "Review the details and confirm before saving." }, 400);

    if (body.kind === "task") {
      if (typeof body.taskId !== "string" || !uuid.test(body.taskId) ||
          typeof body.owner !== "string" || body.owner.length > 120 ||
          typeof body.dueDate !== "string") return reply({ error: "Check the task owner and deadline." }, 400);
      try { explicitSchedule(body.dueDate, "", "UTC"); }
      catch { return reply({ error: "Choose a valid task deadline." }, 400); }
      // Update the existing task only. Completion, priority and source stay intact.
      const result = await supabase.from("action_items")
        .update({ owner: body.owner.trim() || null, due_date: body.dueDate || null })
        .eq("id", body.taskId).eq("meeting_id", id).eq("user_id", user.id)
        .select(columns).maybeSingle();
      if (result.error) return reply({ error: "Couldn't save the task. Your changes are still in the form." }, 500);
      if (!result.data) return reply({ error: "Task not found in this meeting or you cannot edit it." }, 404);
      return reply({ task: result.data });
    }

    if (body.kind === "meeting") {
      if (typeof body.requestId !== "string" || !uuid.test(body.requestId) ||
          typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 200 ||
          typeof body.timeZone !== "string" || !body.timeZone ||
          !Number.isInteger(body.durationMinutes) || body.durationMinutes < 5 || body.durationMinutes > 480) {
        return reply({ error: "Check the meeting title, timezone and duration (5–480 minutes)." }, 400);
      }
      let schedule;
      try {
        schedule = explicitSchedule(body.date, body.time, body.timeZone);
        if (!schedule?.at) throw new Error("Choose a date and time for the follow-up.");
      } catch (error) {
        return reply({ error: error instanceof Error ? error.message : "Check the date and time." }, 400);
      }
      const title = body.title.trim();
      const sessionColumns = "id,title,scheduled_start,duration_minutes";
      const sameRequest = (row: { title: string; scheduled_start: string; duration_minutes: number }) =>
        row.title === title && Date.parse(row.scheduled_start) === Date.parse(schedule.at!) &&
        row.duration_minutes === body.durationMinutes;

      // A client-generated primary key makes retries safe, even after a lost response.
      const previous = await supabase.from("live_sessions").select(sessionColumns)
        .eq("id", body.requestId).eq("created_by", user.id).maybeSingle();
      if (previous.error) return reply({ error: "Couldn't check this meeting. Please retry." }, 500);
      if (previous.data) return sameRequest(previous.data)
        ? reply({ session: previous.data, schedule, reused: true })
        : reply({ error: "This save request was already used for different details. Reopen the form." }, 409);

      if (Date.parse(schedule.at) <= Date.now()) return reply({ error: "Choose a future meeting time." }, 400);
      const denied = await featureError(user.id, "hosting");
      if (denied) return reply({ error: denied }, 402);
      const result = await supabase.from("live_sessions").insert({
        id: body.requestId, created_by: user.id, title, meeting_type: "general",
        scheduled_start: schedule.at, duration_minutes: body.durationMinutes,
        // meeting_id is reserved for this call's eventual recording, not its source.
      }).select(sessionColumns).single();
      if (result.error?.code === "23505") {
        const retry = await supabase.from("live_sessions").select(sessionColumns)
          .eq("id", body.requestId).eq("created_by", user.id).maybeSingle();
        if (!retry.error && retry.data && sameRequest(retry.data)) {
          return reply({ session: retry.data, schedule, reused: true });
        }
        return reply({ error: "Couldn't confirm this save. Retry with the same details." }, 409);
      }
      if (result.error || !result.data) return reply({ error: "Couldn't confirm the follow-up save. Retry with the same details to avoid duplicates." }, 500);
      return reply({ session: result.data, schedule });
    }
    return reply({ error: "Unknown follow-through action." }, 400);
  } catch {
    return reply({ error: "Couldn't confirm the save. Keep the details and retry." }, 500);
  }
}

