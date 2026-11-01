import {
  listDueActionItems,
  listDueCommitments,
  listDueMyTaskAssignments,
  listDueReminders,
} from "./database";
import { AttentionItem } from "./types";
import { commitmentAttentionTitle } from "./commitment-text";
import { dateKey } from "./work-calendar";

function daysBetween(isoDate: string, referenceISO: string): number {
  const a = new Date(isoDate + "T00:00:00Z").getTime();
  const b = new Date(referenceISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

// Lower priority number = more urgent. Signals that make MemoValet's
// "I owe / they owe" differentiator visible (a promise someone else made
// to the user, now overdue) are ranked above generic overdue tasks.
const BASE_PRIORITY = {
  commitmentTheyOweOverdue: 10,
  commitmentIOweOverdue: 20,
  taskOverdue: 30,
  commitmentIOweDueToday: 35,
  commitmentTheyOweDueToday: 36,
  taskDueToday: 40,
  reminderDue: 50,
} as const;

// Unions overdue/due-today signals from tasks, commitments, and reminders
// into one ranked list. Deliberately deterministic (no AI call) so it's
// fast and always available — see AGENTS notes in the audit for why.
export async function getAttentionItems(
  userId: string,
  limit = 6,
  timeZone = "UTC",
  instant = new Date()
): Promise<AttentionItem[]> {
  const today = dateKey(instant, timeZone);
  const now = instant.toISOString();

  const [actionItems, taskAssignments, commitments, reminders] = await Promise.all([
    listDueActionItems(today),
    listDueMyTaskAssignments(userId, today),
    listDueCommitments(today),
    listDueReminders(now),
  ]);

  const items: AttentionItem[] = [];

  for (const item of actionItems) {
    if (item.status !== "todo" || !item.due_date) continue;
    if (item.due_date > today) continue;

    const overdue = item.due_date < today;
    const daysOverdue = overdue ? daysBetween(item.due_date, today) : 0;

    items.push({
      id: "action_item:" + item.id,
      type: overdue ? "task_overdue" : "task_due_today",
      title: item.task,
      description: item.meeting_title ? `From "${item.meeting_title}"` : null,
      priority:
        (overdue ? BASE_PRIORITY.taskOverdue : BASE_PRIORITY.taskDueToday) - daysOverdue,
      dueDate: item.due_date,
      sourceType: "action_item",
      sourceId: item.id,
      relatedPerson: item.owner,
      availableActions: ["open", "complete"],
    });
  }

  for (const task of taskAssignments) {
    if (task.status !== "pending" || !task.due_date) continue;
    if (task.due_date > today) continue;

    const overdue = task.due_date < today;
    const daysOverdue = overdue ? daysBetween(task.due_date, today) : 0;

    items.push({
      id: "task_assignment:" + task.id,
      type: overdue ? "task_overdue" : "task_due_today",
      title: task.title,
      description: `Sent to ${task.recipient_email}`,
      priority:
        (overdue ? BASE_PRIORITY.taskOverdue : BASE_PRIORITY.taskDueToday) - daysOverdue,
      dueDate: task.due_date,
      sourceType: "task_assignment",
      sourceId: task.id,
      relatedPerson: task.recipient_email,
      availableActions: ["open", "remind"],
    });
  }

  for (const commitment of commitments) {
    if (commitment.status !== "pending" || !commitment.due_date) continue;
    if (commitment.due_date > today) continue;

    const overdue = commitment.due_date < today;
    const daysOverdue = overdue ? daysBetween(commitment.due_date, today) : 0;
    const title = commitmentAttentionTitle(commitment);

    if (commitment.direction === "they_owe") {
      items.push({
        id: "commitment:" + commitment.id,
        type: "commitment_overdue_they_owe",
        title,
        description: overdue
          ? `Expected ${commitment.due_date}, ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue.`
          : "Expected today.",
        priority:
          (overdue
            ? BASE_PRIORITY.commitmentTheyOweOverdue
            : BASE_PRIORITY.commitmentTheyOweDueToday) - daysOverdue,
        dueDate: commitment.due_date,
        sourceType: "commitment",
        sourceId: commitment.id,
        relatedPerson: commitment.person_name,
        availableActions: ["open"],
      });
    } else {
      items.push({
        id: "commitment:" + commitment.id,
        type: "commitment_due_i_owe",
        title,
        description: overdue
          ? `Was due ${commitment.due_date}, ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue.`
          : "Due today.",
        priority:
          (overdue
            ? BASE_PRIORITY.commitmentIOweOverdue
            : BASE_PRIORITY.commitmentIOweDueToday) - daysOverdue,
        dueDate: commitment.due_date,
        sourceType: "commitment",
        sourceId: commitment.id,
        relatedPerson: commitment.person_name,
        availableActions: ["complete", "open"],
      });
    }
  }

  for (const reminder of reminders) {
    if (reminder.status !== "pending" || reminder.remind_at > now) continue;

    items.push({
      id: "reminder:" + reminder.id,
      type: "reminder_due",
      title: reminder.title,
      description: reminder.context,
      priority: BASE_PRIORITY.reminderDue,
      dueDate: reminder.remind_at.slice(0, 10),
      sourceType: "reminder",
      sourceId: reminder.id,
      relatedPerson: null,
      availableActions: ["complete"],
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, limit);
}
