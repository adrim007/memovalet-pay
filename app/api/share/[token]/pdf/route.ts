import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { toMeetingResult } from "@/lib/types";
import { buildMeetingPdf } from "@/lib/pdf/meetingPdf";

function sanitizeFilename(title: string) {
  const cleaned = title.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || "meeting_transcript") + ".pdf";
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const supabase = createServiceClient();
    const response = await supabase.from("meetings").select("*").eq("share_token", token).single();

    if (response.error || !response.data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const meeting = response.data;
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
