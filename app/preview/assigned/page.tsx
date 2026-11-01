import AssignedTaskClient from "@/components/AssignedTaskClient";
import type { TaskAssignment } from "@/lib/types";

// What Sam sees on their phone when they open the job Maya sent them: no
// account, just the job, a note, a photo and "Mark as done".
const assignment: TaskAssignment = {
  id: "preview-splashback",
  created_by: "preview-maya",
  createdByEmail: "maya@example.com",
  recipient_email: "sam@tiling.example",
  title: "Install kitchen splashback",
  description: "Tiles are in the garage. Send a photo when it’s done.",
  due_date: "2026-10-02",
  location: null,
  priority: null,
  status: "pending",
  completion_note: null,
  completion_file_url: null,
  notes: [],
  created_at: "2026-09-30T09:00:00.000Z",
  completed_at: null,
};

export default function AssignedPreviewPage() {
  return <AssignedTaskClient assignment={assignment} />;
}
