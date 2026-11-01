import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getMeeting } from "@/lib/database";
import { parseRecordingPath } from "@/lib/recording-path";
import { MAX_RECORDING_CLIPS } from "@/lib/recording-limits";

/** Long enough to watch a whole meeting, pausing along the way. */
const SIGNED_PLAYBACK_SECONDS = 4 * 60 * 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const meeting = await getMeeting(id);
  if (!meeting?.video_url) return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  const clip = new URL(_req.url).searchParams.get("clip");
  const index = clip === null ? 0 : Number(clip);
  if (!Number.isInteger(index) || index < 0 || index >= MAX_RECORDING_CLIPS) return NextResponse.json({ error: "Invalid clip" }, { status: 400 });
  const recording = meeting.metadata?.recording_urls?.[index] ?? (index === 0 ? meeting.video_url : null);
  const path = recording ? parseRecordingPath(recording) : null;
  if (!path) return NextResponse.json({ error: "This older recording uses a legacy link" }, { status: 404 });
  // Authorisation above uses the caller's RLS, signing only this meeting's stored object.
  // The player keeps fetching from this address as the recording plays, so it
  // has to outlast the recording: at five minutes a part stopped playing
  // partway through, and skipping ahead after that failed.
  const { data, error } = await createServiceClient().storage.from("meeting-recordings").createSignedUrl(path, SIGNED_PLAYBACK_SECONDS);
  if (error || !data) return NextResponse.json({ error: "Recording is unavailable. Try again shortly." }, { status: 503 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
