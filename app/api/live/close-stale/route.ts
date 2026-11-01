import { NextResponse } from "next/server";
import { sweepStaleSessions } from "@/lib/close-stale-sessions";
import { carriesSecret } from "@/lib/scheduler-auth";

// Closes calls nobody closed, on a schedule. The sweep itself lives in
// lib/close-stale-sessions so starting a new call can run it too.
export async function GET(req: Request) {
  if (!carriesSecret(req, process.env.CRON_SECRET)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const result = await sweepStaleSessions();
  console.log("[calls] closed", result.closed, "of", result.checked, "open, livekit:", result.reachedLiveKit);
  return NextResponse.json(result);
}
