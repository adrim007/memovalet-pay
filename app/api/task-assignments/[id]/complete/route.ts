import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  completeTaskAssignment,
  createNotification,
  getHostEmail,
  getTaskAssignmentPublic,
} from "@/lib/database";
import { sendAppEmail } from "@/lib/email/send";
import { requestPaymentForAssignment, type PaymentRequestResult } from "@/lib/payments";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const assignment = await getTaskAssignmentPublic(id);

    if (!assignment) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Already done: short-circuit so the capability URL can't be replayed to
    // re-upload files or re-trigger the completion email/notification.
    if (assignment.status === "done") {
      return NextResponse.json({ assignment });
    }

    const formData = await req.formData();
    const note = typeof formData.get("note") === "string" ? (formData.get("note") as string) : "";
    const file = formData.get("file");

    // This endpoint is unauthenticated (gated only by the task's unguessable
    // id), so bound what an anonymous caller can push into public storage.
    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
    const ALLOWED_IMAGE_TYPES: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/heic": "heic",
      "image/heif": "heif",
    };

    let fileUrl: string | null = null;

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "That file is too large (max 10 MB)" },
          { status: 413 }
        );
      }

      const ext = ALLOWED_IMAGE_TYPES[file.type];
      if (!ext) {
        return NextResponse.json(
          { error: "Only image files (JPEG, PNG, WebP, GIF, HEIC) can be attached" },
          { status: 415 }
        );
      }

      const service = createServiceClient();
      const path = `assignments/${id}/${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await service.storage
        .from("task-photos")
        .upload(path, buffer, { contentType: file.type });

      if (uploadError) {
        console.error(uploadError);
        return NextResponse.json({ error: "Couldn't upload that file" }, { status: 500 });
      }

      const { data } = service.storage.from("task-photos").getPublicUrl(path);
      fileUrl = data.publicUrl;
    }

    const updated = await completeTaskAssignment(id, { note, fileUrl });

    if (!updated) {
      return NextResponse.json({ error: "Couldn't mark that task done" }, { status: 500 });
    }

    // Priced job: the customer gets a payment link the moment it's done.
    let payment: PaymentRequestResult | null = null;
    if (updated.amount_cents && updated.customer_email) {
      payment = await requestPaymentForAssignment(updated, new URL(req.url).origin);
      if (!payment.ok) console.error("Payment request after completion failed:", payment.message);
    }

    const creatorEmail = await getHostEmail(assignment.created_by);
    if (creatorEmail) {
      try {
        const subject = "Task completed: " + assignment.title;
        const bodyText =
          assignment.recipient_email +
          ' marked "' +
          assignment.title +
          '" as done.\n\n' +
          (note ? "Note: " + note + "\n" : "") +
          (fileUrl ? "Attachment: " + fileUrl + "\n" : "");

        await sendAppEmail({
          to: creatorEmail,
          subject,
          text: bodyText,
          userId: assignment.created_by,
        });
      } catch (err) {
        console.error("Couldn't notify the task creator", err);
      }
    }

    await createNotification({
      userId: assignment.created_by,
      type: "task_completed",
      title: `${assignment.recipient_email} marked "${assignment.title}" as done`,
      body: note || null,
      link: "/tasks",
    });

    return NextResponse.json({
      assignment: payment?.ok ? { ...updated, payment_status: "pending" } : updated,
      payment: payment
        ? payment.ok
          ? { requested: true, emailed: payment.emailed }
          : { requested: false, reason: payment.reason, message: payment.message }
        : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error completing task" }, { status: 500 });
  }
}
