import { randomUUID } from "crypto";

export interface EmailAttachment { filename: string; content: Buffer }

const encoded = (text: string) => Buffer.from(text, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";

/** Build a UTF-8 message without dropping attachments on the Gmail path. */
export function buildMimeMessage(to: string, subject: string, text: string, attachments: EmailAttachment[] = []) {
  if (/[\r\n]/.test(to) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) throw new Error("Invalid recipient");
  const boundary = `memovalet_${randomUUID()}`;
  const parts = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject.replace(/[\r\n]/g, " ")).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
    `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64", "", encoded(text),
  ];
  for (const file of attachments) {
    const filename = file.filename.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const type = filename.endsWith(".pdf") ? "application/pdf" : filename.endsWith(".txt") ? "text/plain; charset=UTF-8" : filename.endsWith(".ics") ? "text/calendar; method=REQUEST" : "application/octet-stream";
    parts.push(`--${boundary}`, `Content-Type: ${type}`, `Content-Disposition: attachment; filename="${filename}"`, "Content-Transfer-Encoding: base64", "", file.content.toString("base64").match(/.{1,76}/g)?.join("\r\n") || "");
  }
  parts.push(`--${boundary}--`);
  return Buffer.from(parts.join("\r\n")).toString("base64url");
}
