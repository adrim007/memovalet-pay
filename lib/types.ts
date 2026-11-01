import type { Priority } from "@/lib/priority";
export interface ActionItem {
  task: string;
  owner?: string;
  due_date?: string;
  priority?: string;
}

export interface FollowUpEmail {
  subject?: string;
  body?: string;
}

export interface MeetingMetadata {
  recording_urls?: string[];
  summary_status?: "pending" | "processing" | "ready";
  summary_started_at?: string;
  summary_attempt?: string;
  title?: string;
  duration?: string;
  sentiment?: string;
}

export interface MeetingResult {
  meeting_summary?: string;
  key_decisions?: string[];
  action_items?: ActionItem[];
  follow_up_email?: FollowUpEmail;
  metadata?: MeetingMetadata;
}

export type MeetingType = "general" | "sales" | "one_on_one" | "standup" | "planning";

export interface SaveMeetingInput {
  userId: string;
  title: string;
  participants: string;
  transcript: string;
  result: MeetingResult;
  meetingType?: MeetingType;
  teamId?: string | null;
  videoUrl?: string | null;
  projectId?: string | null;
}

export interface ExportOptions {
  exportToDocs?: boolean;
  exportToTrello?: boolean;
  exportToSlack?: boolean;
  exportToNotion?: boolean;
  emailAttendees?: boolean;
}

export interface AttendeeInfo {
  name: string;
  email: string;
  accepted: boolean;
}

export interface TrelloCard {
  name: string;
  url: string;
}

export interface ExportResults {
  docsUrl?: string;
  trelloCards?: TrelloCard[];
  postedToSlack?: boolean;
  notionUrl?: string;
  attendeesEmailed?: number;
  failedExports?: string[];
}

export interface SavedMeeting {
  id: string;
  /** Who recorded it. Team members can open a meeting they don't own. */
  user_id: string;
  title: string;
  participants: string | null;
  transcript: string;
  summary: string | null;
  decisions: string[] | null;
  action_items: ActionItem[] | null;
  follow_up_email: FollowUpEmail | null;
  metadata: MeetingMetadata | null;
  created_at: string;
  share_token: string | null;
  team_id: string | null;
  meeting_type: MeetingType | null;
  video_url: string | null;
  notes: string | null;
  project_id: string | null;
  folder_id?: string | null;
  priority?: Priority | null;
}

// Card/list views that only ever show a title, summary, and counts should use
// this instead of SavedMeeting, so the query never pulls the (often large)
// transcript and notes text just to render a list.
export type LightMeeting = Pick<
  SavedMeeting,
  "id" | "title" | "participants" | "summary" | "decisions" | "action_items" | "created_at"
>;

export interface Project {
  due_date?: string | null;
  due_at?: string | null;
  time_zone?: string | null;
  id: string;
  created_by: string;
  team_id: string | null;
  name: string;
  client_name: string | null;
  status: "active" | "closed";
  created_at: string;
  priority?: Priority | null;
}

export interface ActionItemRecord {
  id: string;
  meeting_id: string;
  user_id: string;
  task: string;
  owner: string | null;
  due_date: string | null;
  priority: Priority | null;
  status: "todo" | "done";
  created_at: string;
  completed_at: string | null;
  meeting_title?: string;
  location: string | null;
  photo_url: string | null;
  reminder_at: string | null;
}

export type DocumentType = "passport" | "drivers_license" | "boarding_pass" | "other";

export type DocumentColor = "yellow" | "blue" | "green" | "orange";

export const DOCUMENT_COLORS: { value: DocumentColor; label: string; dot: string }[] = [
  { value: "yellow", label: "Yellow", dot: "bg-amber-400" },
  { value: "blue", label: "Blue", dot: "bg-blue-400" },
  { value: "green", label: "Green", dot: "bg-emerald-400" },
  { value: "orange", label: "Orange", dot: "bg-orange-400" },
];

export interface UserDocument {
  id: string;
  user_id: string;
  doc_type: DocumentType | null;
  title: string;
  file_path: string;
  mime_type: string | null;
  folder_id: string | null;
  notes: string | null;
  color: DocumentColor | null;
  created_at: string;
  priority?: Priority | null;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface LiveSession {
  id: string;
  created_by: string;
  title: string;
  meeting_type: MeetingType;
  status: "active" | "ended";
  meeting_id: string | null;
  scheduled_start: string | null;
  duration_minutes: number | null;
  invite_email: string | null;
  invite_status: "pending" | "accepted";
  created_at: string;
  ended_at: string | null;
}

export interface LiveSessionPublic {
  id: string;
  title: string;
  meetingType: MeetingType;
  status: "active" | "ended";
  scheduledStart: string | null;
  durationMinutes: number | null;
  endedAt?: string | null;
  createdAt?: string | null;
}

export interface Team {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  role?: "owner" | "member";
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  email?: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  token: string;
  invited_email: string | null;
  created_by: string;
  created_at: string;
  accepted_at: string | null;
}

export interface TaskNote {
  text: string;
  author: "sender" | "recipient";
  created_at: string;
}

export interface TaskAssignment {
  id: string;
  created_by: string;
  recipient_email: string;
  title: string;
  description: string | null;
  due_date: string | null;
  location: string | null;
  priority: Priority | null;
  status: "pending" | "done";
  completion_note: string | null;
  completion_file_url: string | null;
  notes: TaskNote[];
  created_at: string;
  completed_at: string | null;
  createdByEmail?: string;
  // Payments (Business accounts): optional price charged to the customer
  // once the job is marked done.
  amount_cents?: number | null;
  currency?: string;
  customer_email?: string | null;
  payment_status?: "none" | "pending" | "paid" | "failed";
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  paid_at?: string | null;
}

export interface StripeAccountLink {
  user_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  details_submitted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  task_assignment_id: string | null;
  amount_cents: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  customer_email: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export type MeetingProvider = "google-meet" | "zoom" | "teams";

export interface UpcomingCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  meetLink: string;
  // Which service the link belongs to, when we recognise it.
  provider?: MeetingProvider;
  attendees: AttendeeInfo[];
  source: "calendar" | "manual" | "email";
}

export interface Person {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  last_interaction_at: string | null;
  created_at: string;
}

export type CommitmentDirection = "i_owe" | "they_owe";
export type CommitmentStatus = "pending" | "completed" | "overdue" | "cancelled";
export type CommitmentSourceType = "meeting" | "task" | "manual" | "note";

export interface Commitment {
  reminder_at?: string | null;
  due_at?: string | null;
  time_zone?: string | null;
  id: string;
  user_id: string;
  description: string;
  direction: CommitmentDirection;
  person_id: string | null;
  person_name: string | null;
  due_date: string | null;
  priority: Priority | null;
  status: CommitmentStatus;
  source_type: CommitmentSourceType | null;
  source_id: string | null;
  confidence: "manual" | "ai_suggested";
  created_at: string;
  completed_at: string | null;
}

export type ReminderRelatedType = "meeting" | "task" | "document" | "person";
export type ReminderStatus = "pending" | "done" | "dismissed";

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  context: string | null;
  remind_at: string;
  related_type: ReminderRelatedType | null;
  related_id: string | null;
  status: ReminderStatus;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string | null;
  body: string;
  created_at: string;
  folder_id?: string | null;
  priority?: Priority | null;
}

// A unified, prioritized "needs your attention" signal, computed from
// several underlying tables rather than stored — see lib/attention.ts.
export type AttentionType =
  | "commitment_overdue_they_owe"
  | "commitment_due_i_owe"
  | "task_overdue"
  | "task_due_today"
  | "reminder_due"
  | "meeting_today";

export interface AttentionItem {
  id: string;
  type: AttentionType;
  title: string;
  description: string | null;
  priority: number; // lower = more urgent
  dueDate: string | null;
  sourceType: "commitment" | "action_item" | "task_assignment" | "reminder" | "calendar";
  sourceId: string;
  relatedPerson: string | null;
  availableActions: ("remind" | "open" | "complete" | "prepare")[];
}

export function toMeetingResult(saved: SavedMeeting): MeetingResult {
  return {
    meeting_summary: saved.summary ?? undefined,
    key_decisions: saved.decisions ?? undefined,
    action_items: saved.action_items ?? undefined,
    follow_up_email: saved.follow_up_email ?? undefined,
    metadata: saved.metadata ?? undefined,
  };
}

export type AccountType = "personal" | "business";

export interface SharedItem {
  id: string;
  item_type: "note" | "project";
  item_id: string;
  owner_id: string;
  shared_with_user_id: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  title: string;
  url: string;
  created_at: string;
}

// The Library: every meeting, file and note in one timeline, filed into
// spaces. A space is one of the user's folders.
export type LibraryItemKind = "meeting" | "file" | "note";

export interface LibraryItem {
  id: string;
  kind: LibraryItemKind;
  title: string;
  detail: string | null;
  createdAt: string;
  folderId: string | null;
  href: string;
  // Team meetings and notes shared with you appear here too; only their owner
  // can file, mark or delete them.
  isOwner: boolean;
  needsFollowUp: boolean;
  /** How urgent you marked it. Most things are never marked. */
  priority: Priority | null;
}

export interface LibrarySpace {
  id: string;
  name: string;
  parentId: string | null;
}
