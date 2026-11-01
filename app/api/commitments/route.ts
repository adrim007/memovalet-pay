import { explicitSchedule, parseSchedule, reminderInstant } from "@/lib/schedule-text";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCommitment, listCommitments } from "@/lib/database";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const url = new URL(req.url);
    const direction = url.searchParams.get("direction");
    const commitments = await listCommitments(
      direction === "i_owe" || direction === "they_owe" ? direction : undefined
    );

    return NextResponse.json({ commitments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load commitments" }, { status: 500 });
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

    const body = await req.json();
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const direction = body.direction === "i_owe" || body.direction === "they_owe"
      ? body.direction
      : null;

    if (!description || !direction) {
      return NextResponse.json(
        { error: "Description and direction are required" },
        { status: 400 }
      );
    }

    let schedule;
    let reminderAt;
    try {
      reminderAt = body.reminderLocal ? reminderInstant(body.reminderLocal, body.timeZone) : null;
      schedule = body.dueDate ? explicitSchedule(body.dueDate, body.dueTime, body.timeZone) : typeof body.timeZone === "string" ? parseSchedule(description, body.timeZone) : null;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Please check the date and time." }, { status: 400 });
    }

    const commitment = await createCommitment({
      userId: user.id,
      reminderAt,
      description,
      direction,
      personName: typeof body.personName === "string" ? body.personName.trim() : null,
      dueDate: schedule?.date,
      dueAt: schedule?.at,
      timeZone: schedule?.timeZone,
      sourceType: "manual",
    });

    if (!commitment) {
      return NextResponse.json({ error: "Couldn't create that" }, { status: 500 });
    }

    return NextResponse.json({ commitment, schedule });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create commitment" }, { status: 500 });
  }
}
