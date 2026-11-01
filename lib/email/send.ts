import { Resend } from "resend";
import { sendEmailWithAttachments } from "@/lib/exports/gmail";

// App notifications (task sent, reminders, invites, task updates).
//
// Before this existed, every one of these went out through the *sender's*
// personal Gmail via their stored Google token — which only exists if they
// signed in with Google AND connected Gmail in Settings, and silently stops
// working once that token goes stale. Most sends failed, and the routes hid
// it. This sends through Resend (a server-side sender, works for every user,
// from a MemoValet address) when RESEND_API_KEY is set, falls back to the
// user's Gmail when it isn't, and never throws: callers get an honest
// `sent` flag to surface to the user instead of pretending it worked.
//
// Explicit "export this meeting to my Gmail" features are NOT routed here on
// purpose — those are meant to come from the user's own account.

export interface SendAppEmailInput {
  to: string;
  idempotencyKey?: string;
  subject: string;
  text: string;
  /** Sender's user id, used only for the Gmail fallback. */
  userId?: string | null;
  /** Optional calendar invite to attach (live-session invites). */
  ics?: string;
  /**
   * Files to attach. Both providers preserve all selected attachments.
   */
  attachments?: Array<{ filename: string; content: Buffer }>;
}

export interface SendAppEmailResult {
  sent: boolean;
  via: "resend" | "gmail" | "none";
  error?: string;
}

const DEFAULT_FROM = "MemoValet <onboarding@resend.dev>";

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function buildAttachments(input: SendAppEmailInput) {
  const files: Array<{ filename: string; content: string }> = [];

  if (input.ics) {
    files.push({ filename: "invite.ics", content: Buffer.from(input.ics, "utf-8").toString("base64") });
  }
  for (const file of input.attachments || []) {
    files.push({ filename: file.filename, content: file.content.toString("base64") });
  }

  return files.length ? files : undefined;
}

export async function sendAppEmail(input: SendAppEmailInput): Promise<SendAppEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM || DEFAULT_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        attachments: buildAttachments(input),
      }, input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined);
      if (error) {
        console.error("Resend send failed", error);
      } else {
        return { sent: true, via: "resend" };
      }
    } catch (err) {
      console.error("Resend send failed", err);
    }
  }

  if (input.userId && !input.idempotencyKey) {
    try {
      const attachments = [...(input.attachments || [])];
      if (input.ics) attachments.push({ filename: "invite.ics", content: Buffer.from(input.ics, "utf8") });
      await sendEmailWithAttachments(input.userId, input.to, input.subject, input.text, attachments);
      return { sent: true, via: "gmail" };
    } catch (err) {
      const message = errorMessage(err);
      console.error("Gmail fallback send failed", message);
      return { sent: false, via: "none", error: message };
    }
  }

  return {
    sent: false,
    via: "none",
    error: apiKey ? "Email provider rejected the message" : "No email provider is configured",
  };
}
