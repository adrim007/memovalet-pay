import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMeeting } from "@/lib/database";
import { getTranslatedTranscript, validTranslationLanguage } from "@/lib/transcript-translation";

export const maxDuration = 300;
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { targetLanguage } = await req.json();
    if (!validTranslationLanguage(targetLanguage)) return NextResponse.json({ error: "Choose a supported language" }, { status: 400 });
    const meeting = await getMeeting(id);
    if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    const transcript = await getTranslatedTranscript(id, meeting.transcript, targetLanguage);
    return NextResponse.json({ transcript, saved: true, language: targetLanguage });
  } catch (error) {
    console.error("Transcript translation failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't translate this transcript" }, { status: 503 });
  }
}
