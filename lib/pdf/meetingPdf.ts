import PDFDocument from "pdfkit";
import { MeetingResult } from "../types";
import { writeUnicodeText } from "./unicode-text";

export function buildMeetingPdf(title: string, result: MeetingResult): Promise<Buffer> {
  return new Promise(function (resolve, reject) {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", function (chunk) {
      chunks.push(chunk);
    });
    doc.on("end", function () {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    const text = (value: string, size = 11) => writeUnicodeText(doc, value, size);
    text(title, 20);
    doc.moveDown();

    text("Summary", 14);
    text(result.meeting_summary || "");
    doc.moveDown();

    const decisions = result.key_decisions || [];
    if (decisions.length > 0) {
      text("Key Decisions", 14);
      decisions.forEach(function (d) {
        text("• " + d);
      });
      doc.moveDown();
    }

    const actionItems = result.action_items || [];
    if (actionItems.length > 0) {
      text("Action Items", 14);
      actionItems.forEach(function (item) {
        const owner = item.owner ? " (" + item.owner + ")" : "";
        const due = item.due_date ? " (due " + item.due_date + ")" : "";
        text("• " + item.task + owner + due);
      });
      doc.moveDown();
    }

    if (result.follow_up_email && result.follow_up_email.body) {
      text("Follow Up Email", 14);
      if (result.follow_up_email.subject) {
        text(result.follow_up_email.subject);
      }
      text(result.follow_up_email.body);
    }

    doc.end();
  });
}
