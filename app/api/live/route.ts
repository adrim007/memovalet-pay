import { featureError } from "@/lib/plan-access";
import { explicitSchedule, parseSchedule } from "@/lib/schedule-text";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLiveSession } from "@/lib/database";
import { sweepStaleSessions } from "@/lib/close-stale-sessions";
import { MeetingType } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const denied = await featureError(user.id, "hosting");
    if (denied) return NextResponse.json({ error: denied }, { status: 402 });
    const body = await req.json();
    const title =
      typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Live session";
    const meetingType: MeetingType = body.meetingType || "general";
    let schedule = null;
    if ("dueDate" in body || typeof body.naturalText === "string") {
      try {
        schedule = "dueDate" in body ? explicitSchedule(body.dueDate, body.dueTime, body.timeZone) : parseSchedule(body.naturalText, body.timeZone);
        if (!schedule?.at) throw new Error("Please include a meeting date and time, such as tomorrow at 1pm.");
        if (Date.parse(schedule.at) <= Date.now()) throw new Error("Please choose a future meeting time.");
      } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Please check the date and time." }, { status: 400 }); }
    }
    const scheduledStart = schedule?.at ||
      (typeof body.scheduledStart === "string" && body.scheduledStart ? body.scheduledStart : null);
    const durationMinutes =
      typeof body.durationMinutes === "number" && body.durationMinutes > 0
        ? body.durationMinutes
        : null;

    const session = await createLiveSession({
      userId: user.id,
      title,
      meetingType,
      scheduledStart,
      durationMinutes,
    });

    if (!session) {
      return NextResponse.json({ error: "Couldn't start a live session" }, { status: 500 });
    }

    // Tidy up calls nobody closed while we are here, so "live" means live
    // without waiting for the nightly sweep. Never holds up starting this one.
    void sweepStaleSessions().catch(() => {});

    return NextResponse.json({ session, schedule });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error starting live session" }, { status: 500 });
  }
}
