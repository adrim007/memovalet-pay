import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { monthRange } from "@/lib/work-calendar";
import { getWorkCalendar } from "@/lib/work-calendar-data";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
    const params = new URL(request.url).searchParams;
    const month = params.get("month") || "";
    const timeZone = params.get("timeZone") || "UTC";
    try {
      monthRange(month);
      new Intl.DateTimeFormat("en", { timeZone }).format();
    } catch {
      return NextResponse.json({ error: "Choose a valid month and timezone." }, { status: 400, headers });
    }
    return NextResponse.json(await getWorkCalendar(supabase, user.id, month, timeZone), { headers });
  } catch (error) {
    console.error("Work calendar failed", error);
    return NextResponse.json({ error: "Your calendar could not be loaded. Please try again." }, { status: 500, headers });
  }
}
