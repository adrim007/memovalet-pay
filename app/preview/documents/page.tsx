import AppShell from "@/components/AppShell";
import DocumentsClient from "@/components/DocumentsClient";
import LibraryTabs from "@/components/LibraryTabs";
import { Folder, LightMeeting, UserDocument } from "@/lib/types";

function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

const travelFolderId = crypto.randomUUID();
const workFolderId = crypto.randomUUID();

const folders: Folder[] = [
  {
    id: travelFolderId,
    user_id: "mock-user",
    name: "Travel",
    parent_id: null,
    created_at: daysAgo(20),
  },
  {
    id: workFolderId,
    user_id: "mock-user",
    name: "Work",
    parent_id: null,
    created_at: daysAgo(15),
  },
];

const documents: UserDocument[] = [
  {
    id: crypto.randomUUID(),
    user_id: "mock-user",
    doc_type: null,
    title: "My passport",
    file_path: "mock-user/passport.jpg",
    mime_type: "image/jpeg",
    folder_id: null,
    notes: "Expires March 2029.",
    color: "orange",
    priority: "high",
    created_at: daysAgo(30),
  },
  {
    id: crypto.randomUUID(),
    user_id: "mock-user",
    doc_type: null,
    title: "SYD → NRT boarding pass",
    file_path: "mock-user/boarding-pass.pdf",
    mime_type: "application/pdf",
    folder_id: travelFolderId,
    notes: null,
    color: "blue",
    created_at: daysAgo(1),
  },
  {
    id: crypto.randomUUID(),
    user_id: "mock-user",
    doc_type: null,
    title: "Contract draft",
    file_path: "mock-user/contract.pdf",
    mime_type: "application/pdf",
    folder_id: workFolderId,
    notes: null,
    color: null,
    created_at: daysAgo(5),
  },
];

const meetingPacks: LightMeeting[] = [
  {
    id: "preview-meeting-pack",
    title: "Product launch planning",
    participants: "Maya, Camille, Jordan",
    summary: "The team agreed on the launch timeline, owners, and the final pricing review.",
    decisions: ["Launch on 15 September", "Use the revised pricing page"],
    action_items: [
      { task: "Send the updated plan", owner: "Maya" },
      { task: "Review by Wednesday", owner: "Camille" },
    ],
    created_at: daysAgo(1),
  },
];

export default function DocumentsPreviewPage() {
  return (
    <AppShell userEmail="maya@example.com">
      <LibraryTabs base="/preview" />
      <DocumentsClient documents={documents} folders={folders} meetingPacks={meetingPacks} />
    </AppShell>
  );
}
