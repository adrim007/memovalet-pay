import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMeeting } from "@/lib/database";
import { toMeetingResult } from "@/lib/types";
import { translateMeetingResult } from "@/lib/translateMeeting";
import { SPEECH_LANGUAGE_OPTIONS } from "@/lib/speechRecognition";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const targetLanguage = typeof body.targetLanguage === "string" ? body.targetLanguage.trim() : "";
    if (!SPEECH_LANGUAGE_OPTIONS.some(option => option.label === targetLanguage)) {
      return NextResponse.json({ error: "Choose a supported language" }, { status: 400 });
    }
    const meeting = await getMeeting(id);
    if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    const translated = await translateMeetingResult(toMeetingResult(meeting), targetLanguage);
    if (!translated) return NextResponse.json({ error: "The translation couldn't be completed. Your original summary is unchanged. Please try again." }, { status: 503 });
    return NextResponse.json(translated);
  } catch {
    return NextResponse.json({ error: "Couldn't translate the summary. Please try again." }, { status: 503 });
  }
}
