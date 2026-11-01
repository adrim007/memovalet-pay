import { featureError } from "@/lib/plan-access";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTaskAssignment, listMyTaskAssignments } from "@/lib/database";
import { sendAppEmail } from "@/lib/email/send";
import { formatMoney } from "@/lib/money";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const assignments = await listMyTaskAssignments(user.id);

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error fetching tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const denied = await featureError(user.id, "task_links");
    if (denied) return NextResponse.json({ error: denied }, { status: 402 });
    const body = await req.json();
    const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const dueDate = typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null;
    const location = typeof body.location === "string" ? body.location.trim() : "";
    const amountCents =
      typeof body.amountCents === "number" && Number.isInteger(body.amountCents) && body.amountCents > 0
        ? body.amountCents
        : null;
    const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";

    if (!recipientEmail || !title) {
      return NextResponse.json(
        { error: "A recipient email and a task title are required" },
        { status: 400 }
      );
    }
    if (amountCents && !customerEmail) {
      return NextResponse.json(
        { error: "Add the customer's email so they can be charged when the job is done" },
        { status: 400 }
      );
    }

    const assignment = await createTaskAssignment({
      userId: user.id,
      recipientEmail,
      title,
      description,
      dueDate,
      location,
      amountCents,
      customerEmail: amountCents ? customerEmail : null,
    });

    if (!assignment) {
      return NextResponse.json({ error: "Couldn't create that task" }, { status: 500 });
    }

    const url = new URL(req.url);
    const taskUrl = url.origin + "/assigned/" + assignment.id;
    const fromName = user.email || "Someone on MemoValet";

    const subject = "New task: " + title;
    const bodyText =
      fromName +
      " sent you a task on MemoValet.\n\n" +
      title +
      "\n" +
      (description ? description + "\n" : "") +
      (dueDate ? "Due: " + dueDate + "\n" : "") +
      (location ? "Location: " + location + "\n" : "") +
      (amountCents
        ? "When you mark it done, the customer (" + customerEmail + ") is sent a payment link for " + formatMoney(amountCents, "aud") + ".\n"
        : "") +
      "\nView it and mark it done here: " +
      taskUrl;

    // Never hide a failed send: the task still exists (the sender can copy
    // the link), but the UI needs to know the recipient wasn't emailed.
    const emailResult = await sendAppEmail({
      to: recipientEmail,
      subject,
      text: bodyText,
      userId: user.id,
    });
    if (!emailResult.sent) {
      console.error("Couldn't email the task recipient", emailResult.error);
    }

    return NextResponse.json({ assignment, emailed: emailResult.sent });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error creating task" }, { status: 500 });
  }
}
