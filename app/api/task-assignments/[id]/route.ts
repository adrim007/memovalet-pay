import { NextResponse } from "next/server";
import { getTaskAssignmentPublic } from "@/lib/database";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const assignment = await getTaskAssignmentPublic(id);

    if (!assignment) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error fetching task" }, { status: 500 });
  }
}
