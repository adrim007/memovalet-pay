import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendAppEmail } from "@/lib/email/send";
import { groupedForDigest } from "@/lib/error-report";
import { carriesSecret } from "@/lib/scheduler-auth";

/**
 * Yesterday's faults, once a day, to whoever looks after MemoValet.
 *
 * The point of keeping errors is that somebody reads them. Nothing is sent on
 * a quiet day — a digest that arrives every morning saying "all well" stops
 * being read by the second week.
 */

export async function GET(req: Request) {
  if (!carriesSecret(req, process.env.CRON_SECRET)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const to = process.env.ERROR_DIGEST_TO || process.env.RESEND_FROM;
  if (!to) return NextResponse.json({ sent: false, reason: "nowhere to send it" });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await createServiceClient()
    .from("app_errors")
    .select("message, place, browser, created_at, source")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("Could not read yesterday's errors", error.code);
    return NextResponse.json({ sent: false });
  }
  if (!data?.length) return NextResponse.json({ sent: false, reason: "a quiet day" });

  const groups = groupedForDigest(data);
  const lines = groups.slice(0, 20).map((group) => {
    const where = group.place ? ` on ${group.place}` : "";
    const who = group.browsers.length ? ` · ${group.browsers.join(", ")}` : "";
    return `${group.count}×  ${group.message}${where}${who}`;
  });
  const body = [
    `${data.length} error${data.length === 1 ? "" : "s"} in MemoValet in the last 24 hours, in ${groups.length} kind${groups.length === 1 ? "" : "s"}.`,
    "",
    ...lines,
    groups.length > 20 ? `\n…and ${groups.length - 20} more kinds.` : "",
    "",
    "Most of these are worth ignoring until one repeats. A count climbing day on day is the one to look at.",
  ].join("\n");

  const sent = await sendAppEmail({
    to,
    subject: `MemoValet: ${data.length} error${data.length === 1 ? "" : "s"} yesterday`,
    text: body,
  });
  return NextResponse.json({ sent, errors: data.length, kinds: groups.length });
}
