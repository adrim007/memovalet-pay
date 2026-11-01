import { NextResponse } from "next/server";
import { generateAIText } from "@/lib/ai/provider";
import { getMeeting } from "@/lib/database";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const meeting = await getMeeting(id);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const prompt =
      "You answer questions about a meeting using only the transcript below. " +
      "If the answer isn't in the transcript, say you don't know, don't guess. Be concise. " +
      "Answer in the same language the question is written in, regardless of what language " +
      "the transcript is in.\n\n" +
      "Transcript:\n" +
      meeting.transcript +
      "\n\nQuestion: " +
      question;

    const answer = await generateAIText({
      prompt,
      maxTokens: 500,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error answering question" }, { status: 500 });
  }
}
