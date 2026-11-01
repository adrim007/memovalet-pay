import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTaskAssignmentOwnedBy } from "@/lib/database";
import { requestPaymentForAssignment } from "@/lib/payments";

// POST /api/task-assignments/[id]/charge → owner sends (or re-sends) the
// payment link for a priced job.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const assignment = await getTaskAssignmentOwnedBy(id, user.id);
    if (!assignment) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const result = await requestPaymentForAssignment(assignment, new URL(req.url).origin);
    if (!result.ok) {
      const status = result.reason === "error" ? 500 : result.reason === "stripe_not_configured" ? 503 : 400;
      return NextResponse.json({ error: result.message, reason: result.reason }, { status });
    }

    return NextResponse.json({ url: result.url, emailed: result.emailed });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error sending the payment link" }, { status: 500 });
  }
}
