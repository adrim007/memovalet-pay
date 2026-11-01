import { NextResponse } from "next/server";
import { generateAIText, getAIErrorDetails } from "@/lib/ai/provider";
import { runExports } from "@/lib/exports";
import { createClient } from "@/lib/supabase/server";
import { buildTranscriptPrompt } from "@/lib/prompts";
import { MeetingResult, MeetingType, SavedMeeting, toMeetingResult } from "@/lib/types";
import { parseRecordingPath } from "@/lib/recording-path";
import { getLiveSessionForHost } from "@/lib/database";
import { isWorthSaving } from "@/lib/meeting-worth-saving";
import { MAX_RECORDING_CLIPS } from "@/lib/recording-limits";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES: MeetingType[] = ["general", "sales", "one_on_one", "standup", "planning"];

// Initial requests use requestId for safe retries. History retries use meetingId
// and only the saved transcript, never caller-supplied replacement content.
export async function POST(req: Request) {
  let saved: SavedMeeting | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to save meetings" }, { status: 401 });
    const body = await req.json();
    const id = body.meetingId || body.requestId || crypto.randomUUID();
    if (typeof id !== "string" || !UUID.test(id)) return NextResponse.json({ error: "Invalid meeting reference" }, { status: 400 });
    const existing = await supabase.from("meetings").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (existing.error) throw new Error("Could not check saved meeting");
    saved = existing.data;
    if (!saved && body.meetingId) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

    if (!saved) {
      const transcript = body.transcript;
      const videoUrl = body.videoUrl || null;
      const recordingUrls = body.recordingUrls ?? (videoUrl ? [videoUrl] : []);
      if (!Array.isArray(recordingUrls) || recordingUrls.length > MAX_RECORDING_CLIPS) {
        return NextResponse.json({ error: "Invalid recording clips" }, { status: 400 });
      }
      if (recordingUrls.some(url => typeof url !== "string" || !parseRecordingPath(url)?.startsWith(user.id + "/")))
        return NextResponse.json({ error: "This recording does not belong to your account" }, { status: 403 });
      if (typeof transcript !== "string" || transcript.length > 250000) {
        return NextResponse.json({ error: "Add a transcript or a recording before saving." }, { status: 400 });
      }
      // A call that ran but captured nothing — captions unsupported in that
      // browser, recording left off, nobody typing notes — is still a meeting
      // that happened, and losing it loses the summary, the PDF and everything
      // sent from it. Saving one is allowed only when the live session backs it
      // up: this user's own call, open long enough to be real. That is checked
      // here against our own rows rather than taken on the caller's word.
      if (!transcript.trim() && !videoUrl) {
        const session = UUID.test(String(body.requestId || ""))
          ? await getLiveSessionForHost(String(body.requestId), user.id)
          : null;
        const ranFor = session ? (Date.now() - Date.parse(session.created_at)) / 1000 : 0;
        if (!session || !isWorthSaving({ hasContent: false, elapsedSeconds: ranFor })) {
          return NextResponse.json({ error: "Add a transcript or a recording before saving." }, { status: 400 });
        }
      }
      if (videoUrl && (typeof videoUrl !== "string" || !parseRecordingPath(videoUrl)?.startsWith(user.id + "/"))) {
        return NextResponse.json({ error: "This recording does not belong to your account" }, { status: 403 });
      }
      const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;
      if (projectId) {
        const project = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
        if (project.error || !project.data) return NextResponse.json({ error: "Choose an accessible project" }, { status: 400 });
      }
      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 500) : "Untitled Meeting";
      // Save before constructing the AI client. Even a missing key cannot lose work.
      const insert = await supabase.from("meetings").insert({
        id, user_id: user.id, title,
        participants: typeof body.participants === "string" ? body.participants.slice(0, 10000) : "",
        transcript, summary: null, decisions: [], action_items: [], follow_up_email: null,
        metadata: { title, summary_status: "pending", recording_urls: recordingUrls },
        meeting_type: TYPES.includes(body.meetingType) ? body.meetingType : "general",
        team_id: typeof body.teamId === "string" ? body.teamId : null,
        project_id: projectId, video_url: videoUrl,
      }).select().single();
      if (insert.error?.code === "23505") {
        const duplicate = await supabase.from("meetings").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
        saved = duplicate.data;
      } else if (!insert.error) saved = insert.data;
      if (!saved) throw new Error("Meeting save failed");
    }

    const reply = (warning?: string) => NextResponse.json({
      ...toMeetingResult(saved!), meetingId: saved!.id,
      summaryStatus: saved!.metadata?.summary_status || "ready", warning,
    });
    const metadata = saved.metadata || {};
    if (!metadata.summary_status || metadata.summary_status === "ready") return reply();
    if (body.saveOnly) return reply("Saved in History. You can generate a summary later.");
    if (saved.transcript.trim().length < 20) {
      return reply("Recording saved. A written transcript is needed for a summary; uploaded recordings are not transcribed automatically.");
    }
    if (metadata.summary_status === "processing" && Date.now() - Date.parse(metadata.summary_started_at || "") < 120000) {
      return reply("Saved in History. A summary is already being generated; check back shortly.");
    }
    const attempt = crypto.randomUUID();
    const processing = { ...metadata, summary_status: "processing", summary_started_at: new Date().toISOString(), summary_attempt: attempt };
    // Atomic compare-and-set: simultaneous retries cannot duplicate tasks/exports.
    const claim = await supabase.from("meetings").update({ metadata: processing })
      .eq("id", id).eq("user_id", user.id).eq("metadata", JSON.stringify(metadata)).select("id").maybeSingle();
    if (claim.error || !claim.data) return reply("Saved in History. Check the meeting before retrying its summary.");

    let parsed: MeetingResult;
    try {
      const output = await generateAIText({
        prompt: buildTranscriptPrompt(saved.transcript, saved.meeting_type || "general"),
        // A long meeting with many action items and a full follow-up email ran
        // past 2,000, and an unfinished answer is rejected as a whole — so that
        // meeting failed on every retry. Only what's written is billed.
        maxTokens: 6000,
        timeoutMs: 45000,
        json: true,
      });
      parsed = JSON.parse(output.replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\x60\x60\x60\s*$/, "").trim());
      if (!parsed || typeof parsed.meeting_summary !== "string" || !Array.isArray(parsed.key_decisions) || !parsed.key_decisions.every((item) => typeof item === "string") || !Array.isArray(parsed.action_items) || !parsed.action_items.every((item) => item && typeof item.task === "string")) throw new Error("Invalid summary");
      parsed.metadata = { ...metadata, title: saved.title, summary_status: "ready" };
      const completed = await supabase.from("meetings").update({
        summary: parsed.meeting_summary, decisions: parsed.key_decisions,
        action_items: parsed.action_items, follow_up_email: parsed.follow_up_email || null,
        metadata: parsed.metadata,
      }).eq("id", id).eq("user_id", user.id).eq("metadata->>summary_attempt", attempt).select().single();
      if (completed.error || !completed.data) {
        console.error("Meeting summary persistence failed", { code: completed.error?.code || "no_row" });
        throw new Error("Summary save failed");
      }
      saved = completed.data;
    } catch (error) {
      const failure = getAIErrorDetails(error);
      const category = error instanceof Error && error.message === "Summary save failed"
        ? "persistence"
        : error instanceof Error && error.message === "Invalid summary"
          ? "invalid_output"
          : failure.category;
      // Log only fixed categories/status codes, never transcripts or credentials.
      console.error("Meeting summary failed", { provider: failure.provider, category, status: failure.status });
      await supabase.from("meetings").update({ metadata: { ...metadata, summary_status: "pending" } })
        .eq("id", id).eq("user_id", user.id).eq("metadata->>summary_attempt", attempt);
      return reply("Your meeting and any attached recording are saved in History. The summary couldn't be generated. Retry it from the saved meeting.");
    }

    let warning: string | undefined;
    if (parsed.action_items!.length) {
      const tasks = await supabase.from("action_items").insert(parsed.action_items!.map((item) => ({
        meeting_id: id, user_id: user.id, task: item.task, owner: item.owner || null,
        due_date: item.due_date || null, priority: item.priority || null,
      })));
      if (tasks.error) warning = "Summary saved. Action items are in the summary, but couldn't be added to your task list.";
    }
    // History retries must not silently send emails or repeat external exports.
    let exports;
    if (!body.meetingId) {
      try {
        exports = await runExports(parsed, {
          exportToDocs: body.exportToDocs,
          exportToTrello: body.exportToTrello, exportToSlack: body.exportToSlack,
          exportToNotion: body.exportToNotion, emailAttendees: body.emailAttendees,
        }, user.id, Array.isArray(body.attendees) ? body.attendees : []);
      } catch { warning = "Meeting saved. Automatic sharing couldn't finish; share it from History when you're ready."; }
    }
    return NextResponse.json({ ...parsed, meetingId: id, summaryStatus: "ready", warning, exports });
  } catch {
    if (saved) return NextResponse.json({ meetingId: saved.id, summaryStatus: "pending", warning: "Your meeting is saved in History. Check it there before retrying." });
    return NextResponse.json({ error: "Your meeting wasn't saved. Keep this page open and download your recording before trying again.", code: "SAVE_FAILED" }, { status: 503 });
  }
}
