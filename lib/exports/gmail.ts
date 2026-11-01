import { getGoogleAccessTokenForUser } from "../google/tokens";
import { MeetingResult } from "../types";
import { buildMeetingPdf } from "../pdf/meetingPdf";
import { buildMimeMessage, type EmailAttachment } from "../email/mime";

export async function sendEmailWithAttachments(userId: string, to: string, subject: string, text: string, attachments: EmailAttachment[] = []): Promise<string> {
  const raw = buildMimeMessage(to, subject, text, attachments);
  const accessToken = await getGoogleAccessTokenForUser(userId);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!response.ok) throw new Error("Gmail could not send this email. Reconnect Google in Settings and try again.");
  const data = await response.json();
  if (!data.id) throw new Error("Gmail did not confirm delivery submission.");
  return data.id;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function wrapBase64(base64: string) {
  const lines = base64.match(/.{1,76}/g);
  return lines ? lines.join("\r\n") : base64;
}

function sanitizeFilename(title: string) {
  const cleaned = title.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || "meeting_transcript") + ".pdf";
}

async function buildRawMessageWithPdf(result: MeetingResult, to: string): Promise<string> {
  const title = (result.metadata && result.metadata.title) || "Meeting Notes";
  const subject = "Meeting Transcript & Summary: " + title;
  const body =
    (result.follow_up_email && result.follow_up_email.body) ||
    "Attached is the transcript and summary for this meeting.";
  const filename = sanitizeFilename(title);

  const pdfBuffer = await buildMeetingPdf(title, result);
  const pdfBase64 = wrapBase64(pdfBuffer.toString("base64"));
  const boundary = "memovalet_" + Date.now();

  const message = [
    "To: " + to,
    "Subject: " + subject,
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="' + boundary + '"',
    "",
    "--" + boundary,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
    "",
    "--" + boundary,
    'Content-Type: application/pdf; name="' + filename + '"',
    'Content-Disposition: attachment; filename="' + filename + '"',
    "Content-Transfer-Encoding: base64",
    "",
    pdfBase64,
    "",
    "--" + boundary + "--",
  ].join("\r\n");

  return base64UrlEncode(message);
}

export async function sendCalendarInviteEmail(
  userId: string,
  toEmail: string,
  subject: string,
  body: string,
  icsContent: string
): Promise<string> {
  const accessToken = await getGoogleAccessTokenForUser(userId);
  const icsBase64 = wrapBase64(Buffer.from(icsContent, "utf-8").toString("base64"));
  const boundary = "memovalet_invite_" + Date.now();

  const message = [
    "To: " + toEmail,
    "Subject: " + subject,
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="' + boundary + '"',
    "",
    "--" + boundary,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
    "",
    "--" + boundary,
    'Content-Type: text/calendar; charset="UTF-8"; method=REQUEST; name="invite.ics"',
    'Content-Disposition: attachment; filename="invite.ics"',
    "Content-Transfer-Encoding: base64",
    "",
    icsBase64,
    "",
    "--" + boundary + "--",
  ].join("\r\n");

  const raw = base64UrlEncode(message);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: raw }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Failed to send calendar invite: " + JSON.stringify(data));
  }

  return data.id;
}

export async function sendPlainEmail(
  userId: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<string> {
  const accessToken = await getGoogleAccessTokenForUser(userId);

  const message = [
    "To: " + toEmail,
    "Subject: " + subject,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");

  const raw = base64UrlEncode(message);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: raw }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Failed to send Gmail message: " + JSON.stringify(data));
  }

  return data.id;
}

export async function sendGmailMessage(
  result: MeetingResult,
  userId: string,
  toEmail: string
): Promise<string> {
  const accessToken = await getGoogleAccessTokenForUser(userId);
  const raw = await buildRawMessageWithPdf(result, toEmail);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: raw }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Failed to send Gmail message: " + JSON.stringify(data));
  }

  return data.id;
}
