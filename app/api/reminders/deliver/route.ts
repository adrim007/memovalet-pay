import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { sendAppEmail } from "@/lib/email/send";
import { fromScheduler } from "@/lib/scheduler-auth";

export const maxDuration = 60;
export async function GET(request: Request) {
  const db = createServiceClient();
  if (!(await fromScheduler(request, process.env.CRON_SECRET, db))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = randomUUID();
  const { data: jobs, error } = await db.rpc("claim_timed_reminders", { p_lock: token });
  if (error) return NextResponse.json({ error: "Couldn't load scheduled reminders" }, { status: 503 });
  let sent = 0, skipped = 0, failed = 0;
  for (const job of jobs || []) {
    const finish = async (values: Record<string, unknown>) => {
      const result = await db.from("timed_reminder_deliveries").update({ ...values, lock_token: null, locked_until: null }).eq("id", job.id).eq("lock_token", token);
      if (result.error) throw new Error("Couldn't record delivery state");
    };
    try {
      // Recheck the original reminder so completion, deletion or rescheduling cancels delivery.
      const action = job.source_kind === "action_item";
      const table = action ? "action_items" : job.source_kind === "commitment" ? "commitments" : "reminders";
      const { data: source, error: sourceError } = await db.from(table)
        .select(table === "reminders" ? "status,remind_at" : "status,reminder_at").eq("id", job.source_id).eq("user_id", job.user_id).maybeSingle();
      if (sourceError) throw new Error("Couldn't check the reminder");
      const scheduled = source && ("reminder_at" in source ? source.reminder_at : source.remind_at);
      if (!source || source.status !== (action ? "todo" : "pending") || Date.parse(scheduled) !== Date.parse(job.scheduled_at)) {
        await finish({ state: "skipped" }); skipped++; continue;
      }
      const { data: userData, error: userError } = await db.auth.admin.getUserById(job.user_id);
      if (userError) throw new Error("Couldn't check notification preferences");
      if (!userData.user || userData.user.user_metadata?.notification_prefs?.timed_reminders === false) {
        await finish({ state: "skipped" }); skipped++; continue;
      }
      const notification = await db.from("notifications").upsert({ id: job.id, user_id: job.user_id, type: "timed_reminders", title: job.title, body: "Your scheduled reminder is due.", link: job.link }, { onConflict: "id", ignoreDuplicates: true });
      if (notification.error) throw new Error("Couldn't save the notification");
      const email = job.email_to || userData.user.email;
      if (!email) { await finish({ state: "sent", sent_at: new Date().toISOString() }); sent++; continue; }
      if (!job.email_to) {
        const stored = await db.from("timed_reminder_deliveries").update({ email_to: email }).eq("id", job.id).eq("lock_token", token);
        if (stored.error) throw new Error("Couldn't prepare email delivery");
      }
      const result = await sendAppEmail({
        to: email, subject: "Your MemoValet reminder", idempotencyKey: `timed-reminder/${job.id}`,
        text: `${job.title}\n\nYour scheduled reminder is due.\n\nOpen your workspace: https://memovalet.com${job.link}\n\nManage reminder emails in Settings: https://memovalet.com/settings#notifications`,
      });
      if (!result.sent) throw new Error("Reminder email could not be delivered");
      await finish({ state: "sent", sent_at: new Date().toISOString(), last_error: null }); sent++;
    } catch {
      failed++;
      try { await finish({ last_error: "Delivery failed. A retry is scheduled.", next_attempt_at: new Date(Date.now() + 5 * 60000).toISOString() }); } catch { /* Lease expiry permits recovery. */ }
    }
  }
  return NextResponse.json({ sent, skipped, failed }, { status: failed ? 503 : 200 });
}
