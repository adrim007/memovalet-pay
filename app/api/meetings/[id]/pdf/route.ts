import { featureError } from "@/lib/plan-access";
import { NextResponse } from "next/server";
import { getMeeting } from "@/lib/database";
import { toMeetingResult } from "@/lib/types";
import { buildMeetingPdf } from "@/lib/pdf/meetingPdf";
import { createClient } from "@/lib/supabase/server";

function sanitizeFilename(title: string) {
  const cleaned = title.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || "meeting_transcript") + ".pdf";
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const denied = await featureError(user.id, "exports");
    if (denied) return NextResponse.json({ error: denied }, { status: 402 });
    const meeting = await getMeeting(id);

    if (!meeting) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pdfBuffer = await buildMeetingPdf(meeting.title, toMeetingResult(meeting));

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="' + sanitizeFilename(meeting.title) + '"',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
