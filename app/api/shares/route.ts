import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createNotification,
  findUserIdByEmail,
  getProject,
  listShareRecipients,
  shareItemWithUser,
  unshareItem,
} from "@/lib/database";
import { sendAppEmail } from "@/lib/email/send";
import type { SharedItemType } from "@/lib/database";

type ItemType = SharedItemType;

function parseItemType(value: unknown): ItemType | null {
  return value === "note" || value === "project" || value === "meeting" ? value : null;
}

// GET /api/shares?itemType=note&itemId=... → who it's shared with
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const itemType = parseItemType(searchParams.get("itemType"));
    const itemId = searchParams.get("itemId") || "";
    if (!itemType || !itemId) {
      return NextResponse.json({ error: "itemType and itemId are required" }, { status: 400 });
    }

    const recipients = await listShareRecipients(itemType, itemId);
    return NextResponse.json({ recipients });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error loading shares" }, { status: 500 });
  }
}

// DELETE /api/shares?itemType=note&itemId=...&userId=... → owner removes access
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const itemType = parseItemType(searchParams.get("itemType"));
    const itemId = searchParams.get("itemId") || "";
    const recipientUserId = searchParams.get("userId") || "";
    if (!itemType || !itemId || !recipientUserId) {
      return NextResponse.json({ error: "itemType, itemId and userId are required" }, { status: 400 });
    }

    const ok = await unshareItem({ itemType, itemId, recipientUserId });
    if (!ok) return NextResponse.json({ error: "That share wasn't found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error removing that share" }, { status: 500 });
  }
}

// POST /api/shares { itemType, itemId, email }
// Shares a note or project with another MemoValet user and notifies them
// in-app. If the email has no MemoValet account yet, nothing is shared —
// the caller is told so it can offer to email a link instead.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const itemType = parseItemType(body.itemType);
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!itemType || !itemId || !email) {
      return NextResponse.json({ error: "itemType, itemId and email are required" }, { status: 400 });
    }

    // Confirm the caller actually owns what they're sharing.
    let title = "";
    let noteBody = "";
    if (itemType === "meeting") {
      const meeting = await supabase.from("meetings").select("id, user_id, title").eq("id", itemId).single();
      if (meeting.error || !meeting.data || meeting.data.user_id !== user.id) {
        return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
      }
      title = meeting.data.title;
    } else if (itemType === "project") {
      const project = await getProject(itemId);
      if (!project || project.created_by !== user.id) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      title = project.name;
    } else {
      const note = await supabase.from("notes").select("id, user_id, title, body").eq("id", itemId).single();
      if (note.error || !note.data || note.data.user_id !== user.id) {
        return NextResponse.json({ error: "Note not found" }, { status: 404 });
      }
      title = note.data.title || note.data.body.slice(0, 60);
      noteBody = note.data.body;
    }

    const fromName = user.email || "Someone on MemoValet";
    const origin = new URL(req.url).origin;

    const recipientUserId = await findUserIdByEmail(email);
    if (!recipientUserId) {
      // No MemoValet account for that email: nothing to share into, so send
      // them the content itself (a note's text, or a project link plus a
      // nudge to sign up) and say so honestly.
      const text =
        itemType === "meeting"
          ? `${fromName} shared the meeting "${title}" with you on MemoValet.\n\nCreate a free account with this email at ${origin}/login and ask ${fromName} to share it again — it'll appear in your library.`
          : itemType === "note"
          ? `${fromName} shared a note with you on MemoValet:\n\n${title}\n\n${noteBody}\n\nSign up at ${origin} to keep notes and tasks like this in one place.`
          : `${fromName} shared the project "${title}" with you on MemoValet.\n\nCreate a free account with this email at ${origin}/login and ask ${fromName} to share it again — it'll appear in your projects.`;
      const emailResult = await sendAppEmail({
        to: email,
        subject: `${fromName} shared "${title}" with you`,
        text,
        userId: user.id,
      });
      return NextResponse.json({ shared: false, reason: "no_account", emailed: emailResult.sent });
    }
    if (recipientUserId === user.id) {
      return NextResponse.json({ error: "That's you — pick someone else" }, { status: 400 });
    }

    const ok = await shareItemWithUser({ itemType, itemId, ownerId: user.id, recipientUserId });
    if (!ok) {
      return NextResponse.json({ error: "Couldn't share that" }, { status: 500 });
    }

    const link =
      itemType === "project" ? `/projects/${itemId}` : itemType === "meeting" ? `/history/${itemId}` : "/notes";
    await createNotification({
      userId: recipientUserId,
      type: "shared_" + itemType,
      title: `${fromName} shared a ${itemType} with you: "${title}"`,
      link,
    });

    // Best-effort email nudge as well; the in-app notification is the source of truth.
    const url = origin + link;
    const emailResult = await sendAppEmail({
      to: email,
      subject: `${fromName} shared "${title}" with you on MemoValet`,
      text: `${fromName} shared a ${itemType} with you: "${title}".\n\nOpen it here: ${url}`,
      userId: user.id,
    });

    return NextResponse.json({ shared: true, emailed: emailResult.sent });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error sharing that" }, { status: 500 });
  }
}
