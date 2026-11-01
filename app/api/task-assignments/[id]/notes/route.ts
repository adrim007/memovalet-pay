import { NextResponse } from "next/server";
import { addTaskNote, getHostEmail, getTaskAssignmentPublic } from "@/lib/database";
import { sendAppEmail } from "@/lib/email/send";

// No auth check here on purpose: the recipient never has a MemoValet
// account, so the unguessable task id is the access control, same as
// the complete route. Both sides post through this one endpoint.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const author = body.author === "sender" || body.author === "recipient" ? body.author : null;

    if (!text || !author) {
      return NextResponse.json({ error: "A note and author are required" }, { status: 400 });
    }

    const assignment = await getTaskAssignmentPublic(id);
    if (!assignment) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updated = await addTaskNote(id, { text, author });
    if (!updated) {
      return NextResponse.json({ error: "Couldn't add that note" }, { status: 500 });
    }

    try {
      if (author === "recipient") {
        const creatorEmail = await getHostEmail(assignment.created_by);
        if (creatorEmail) {
          await sendAppEmail({
            to: creatorEmail,
            subject: "Update on: " + assignment.title,
            text:
              assignment.recipient_email + ' added an update to "' + assignment.title + '":\n\n' + text,
            userId: assignment.created_by,
          });
        }
      } else {
        await sendAppEmail({
          to: assignment.recipient_email,
          subject: "Update on: " + assignment.title,
          text: 'A note was added to "' + assignment.title + '":\n\n' + text,
          userId: assignment.created_by,
        });
      }
    } catch (err) {
      console.error("Couldn't notify about the new note", err);
    }

    return NextResponse.json({ assignment: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error adding note" }, { status: 500 });
  }
}
