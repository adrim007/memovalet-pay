import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createNotification } from "@/lib/database";
import { sendAppEmail } from "@/lib/email/send";
import { carriesSecret } from "@/lib/scheduler-auth";

const ESCALATION_DAYS_THRESHOLD = 3;

const SETTINGS_URL = "https://memovalet.com/settings#notifications";
const OPT_OUT = `\n\nYou can turn these emails off in Settings → Notifications: ${SETTINGS_URL}`;

// These digests went out through each person's own Gmail, so they only ever
// reached people who had connected Google. MemoValet's own email service
// reaches everyone, from a MemoValet address.
async function sendDigest(
  toEmail: string,
  items: { task: string; due_date: string | null; meetingTitle: string }[]
) {
  const lines = items.map(function (i) {
    return "- " + i.task + (i.due_date ? " (was due " + i.due_date + ")" : "") + ' (from "' + i.meetingTitle + '")';
  });
  const plural = items.length === 1 ? "" : "s";
  const result = await sendAppEmail({
    to: toEmail,
    subject: `MemoValet: ${items.length} overdue action item${plural}`,
    text:
      `You have ${items.length} overdue action item${plural}:\n\n` +
      lines.join("\n") +
      "\n\nOpen MemoValet to mark these done or check the full list." +
      OPT_OUT,
  });
  if (!result.sent) throw new Error(result.error || "Email not sent");
}

async function sendEscalationDigest(
  toEmail: string,
  items: { task: string; due_date: string | null; meetingTitle: string; ownerLabel: string }[]
) {
  const lines = items.map(function (i) {
    return "- " + i.task + " (owner: " + i.ownerLabel + (i.due_date ? ", was due " + i.due_date : "") + ') (from "' + i.meetingTitle + '")';
  });
  const plural = items.length === 1 ? "" : "s";
  const result = await sendAppEmail({
    to: toEmail,
    subject: `MemoValet: ${items.length} team action item${plural} significantly overdue`,
    text:
      `As a team owner, you're being notified because ${items.length} team action item${items.length === 1 ? " has" : "s have"} been overdue for ${ESCALATION_DAYS_THRESHOLD}+ days:\n\n` +
      lines.join("\n") +
      "\n\nOpen MemoValet to check in with the owner or reassign." +
      OPT_OUT,
  });
  if (!result.sent) throw new Error(result.error || "Email not sent");
}

/** On unless the person turned "Overdue action items" off in Settings. */
function wantsOverdueEmails(user: { user_metadata?: Record<string, unknown> } | null | undefined) {
  const prefs = (user?.user_metadata?.notification_prefs || {}) as Record<string, unknown>;
  return prefs.overdue_digest !== false;
}

export async function GET(req: Request) {
  if (!carriesSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  const response = await service
    .from("action_items")
    .select("id, user_id, task, owner, due_date, meetings(title, team_id)")
    .eq("status", "todo");

  if (response.error) {
    console.error(response.error);
    return NextResponse.json({ error: "Failed to load action items" }, { status: 500 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueByUser = new Map<
    string,
    { task: string; due_date: string | null; meetingTitle: string }[]
  >();

  const escalationCandidates: {
    userId: string;
    teamId: string;
    task: string;
    owner: string | null;
    due_date: string | null;
    meetingTitle: string;
  }[] = [];

  for (const row of response.data) {
    if (!row.due_date) continue;
    const dueDate = new Date(row.due_date);
    if (isNaN(dueDate.getTime()) || dueDate >= today) continue;

    const meetings = row.meetings as
      | { title?: string; team_id?: string | null }
      | { title?: string; team_id?: string | null }[]
      | null;
    const meeting = Array.isArray(meetings) ? meetings[0] : meetings;
    const meetingTitle = meeting?.title;

    const list = overdueByUser.get(row.user_id) || [];
    list.push({
      task: row.task,
      due_date: row.due_date,
      meetingTitle: meetingTitle || "Untitled meeting",
    });
    overdueByUser.set(row.user_id, list);

    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysOverdue >= ESCALATION_DAYS_THRESHOLD && meeting?.team_id) {
      escalationCandidates.push({
        userId: row.user_id,
        teamId: meeting.team_id,
        task: row.task,
        owner: row.owner,
        due_date: row.due_date,
        meetingTitle: meetingTitle || "Untitled meeting",
      });
    }
  }

  let emailsSent = 0;
  let usersOptedOut = 0;

  for (const [userId, items] of overdueByUser) {
    try {
      const { data: userData } = await service.auth.admin.getUserById(userId);
      if (!userData.user?.email) continue;
      if (!wantsOverdueEmails(userData.user)) {
        usersOptedOut += 1;
        continue;
      }

      await sendDigest(userData.user.email, items);
      emailsSent += 1;
    } catch (err) {
      console.error("Failed to send reminder digest for user " + userId, err);
    }
  }

  let escalationEmailsSent = 0;

  if (escalationCandidates.length > 0) {
    const teamIds = Array.from(new Set(escalationCandidates.map((c) => c.teamId)));
    const ownersResponse = await service
      .from("team_members")
      .select("team_id, user_id")
      .eq("role", "owner")
      .in("team_id", teamIds);

    if (!ownersResponse.error && ownersResponse.data) {
      const ownersByTeam = new Map<string, string[]>();
      for (const row of ownersResponse.data) {
        const list = ownersByTeam.get(row.team_id) || [];
        list.push(row.user_id);
        ownersByTeam.set(row.team_id, list);
      }

      const escalatedByOwner = new Map<
        string,
        { task: string; due_date: string | null; meetingTitle: string; ownerLabel: string }[]
      >();

      for (const candidate of escalationCandidates) {
        const owners = ownersByTeam.get(candidate.teamId) || [];
        for (const ownerId of owners) {
          if (ownerId === candidate.userId) continue;
          const list = escalatedByOwner.get(ownerId) || [];
          list.push({
            task: candidate.task,
            due_date: candidate.due_date,
            meetingTitle: candidate.meetingTitle,
            ownerLabel: candidate.owner || "unassigned",
          });
          escalatedByOwner.set(ownerId, list);
        }
      }

      for (const [ownerId, items] of escalatedByOwner) {
        try {
          const { data: ownerData } = await service.auth.admin.getUserById(ownerId);
          if (!ownerData.user?.email || !wantsOverdueEmails(ownerData.user)) continue;

          await sendEscalationDigest(ownerData.user.email, items);
          escalationEmailsSent += 1;
        } catch (err) {
          console.error("Failed to send escalation digest to team owner " + ownerId, err);
        }
      }
    }
  }

  // Task assignments have no account on the recipient's end, so there's
  // nothing to nudge there automatically, this notifies the sender instead
  // that a task they sent is overdue and still sitting unfinished.
  let taskNotificationsSent = 0;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const taskResponse = await service
    .from("task_assignments")
    .select("id, created_by, title, recipient_email, due_date")
    .eq("status", "pending")
    .not("due_date", "is", null)
    .lte("due_date", tomorrow.toISOString().slice(0, 10));

  if (!taskResponse.error && taskResponse.data) {
    const overdueTasksByUser = new Map<
      string,
      { title: string; recipient_email: string; due_date: string }[]
    >();

    for (const row of taskResponse.data) {
      const list = overdueTasksByUser.get(row.created_by) || [];
      list.push({
        title: row.title,
        recipient_email: row.recipient_email,
        due_date: row.due_date,
      });
      overdueTasksByUser.set(row.created_by, list);
    }

    for (const [userId, items] of overdueTasksByUser) {
      try {
        await createNotification({
          userId,
          type: "task_due_soon",
          title:
            items.length === 1
              ? `"${items[0].title}" is due soon and still not done`
              : `${items.length} tasks you sent are due soon and still not done`,
          body: items.map((i) => `${i.title} (${i.recipient_email})`).join(", "),
          link: "/tasks",
        });
        taskNotificationsSent += 1;
      } catch (err) {
        console.error("Failed to create due-soon notification for user " + userId, err);
      }
    }
  }

  return NextResponse.json({
    emailsSent,
    usersOptedOut,
    usersWithOverdueItems: overdueByUser.size,
    escalationEmailsSent,
    escalationCandidates: escalationCandidates.length,
    taskNotificationsSent,
  });
}
