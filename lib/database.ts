import { cache } from "react";
import { createClient } from "./supabase/server";
import { createServiceClient } from "./supabase/service";
import {
  ActionItemRecord,
  Bookmark,
  Commitment,
  CommitmentDirection,
  Folder,
  LightMeeting,
  LiveSession,
  LiveSessionPublic,
  MeetingType,
  Note,
  Notification,
  Payment,
  Person,
  Project,
  Reminder,
  SaveMeetingInput,
  SavedMeeting,
  StripeAccountLink,
  Team,
  TeamInvite,
  TeamMember,
  TaskAssignment,
  UserDocument,
} from "./types";

export async function saveMeeting(data: SaveMeetingInput): Promise<SavedMeeting | null> {
  const supabase = await createClient();
  const result = data.result;

  const insertData = {
    user_id: data.userId,
    title: data.title,
    participants: data.participants,
    transcript: data.transcript,
    summary: result.meeting_summary,
    decisions: result.key_decisions,
    action_items: result.action_items,
    follow_up_email: result.follow_up_email,
    metadata: result.metadata,
    meeting_type: data.meetingType || "general",
    team_id: data.teamId || null,
    video_url: data.videoUrl || null,
    project_id: data.projectId || null,
  };

  const response = await supabase.from("meetings").insert(insertData).select().single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  if (result.action_items && result.action_items.length > 0) {
    const rows = result.action_items.map(function (item) {
      return {
        meeting_id: response.data.id,
        user_id: data.userId,
        task: item.task,
        owner: item.owner || null,
        due_date: item.due_date || null,
        priority: item.priority || null,
      };
    });

    const itemsResponse = await supabase.from("action_items").insert(rows);
    if (itemsResponse.error) {
      console.error(itemsResponse.error);
    }
  }

  return response.data;
}

export async function getMeeting(id: string): Promise<SavedMeeting | null> {
  const supabase = await createClient();
  const response = await supabase.from("meetings").select("*").eq("id", id).single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

export async function updateMeetingTitle(id: string, title: string): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase.from("meetings").update({ title }).eq("id", id);

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return true;
}

export async function updateMeetingNotes(id: string, notes: string): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase.from("meetings").update({ notes }).eq("id", id).select("id").maybeSingle();

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return !!response.data;
}

export async function listMeetings(): Promise<SavedMeeting[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("meetings")
    .select("*")
    .is("team_id", null)
    .order("created_at", { ascending: false });

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function listTeamMeetings(teamId: string): Promise<SavedMeeting[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("meetings")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function listAllVisibleMeetings(): Promise<SavedMeeting[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("meetings")
    .select("*")
    .order("created_at", { ascending: false });

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

// For list/card views (People, etc.) that only ever show a title, summary,
// and participant names — never the transcript — so the query doesn't pull
// that (often large) text for every visible meeting just to render a list.
export async function listVisibleMeetingsLight(limit?: number): Promise<LightMeeting[]> {
  const supabase = await createClient();
  let query = supabase
    .from("meetings")
    .select("id, title, participants, summary, decisions, action_items, created_at")
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const response = await query;

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export interface DashboardStats {
  totalMeetings: number;
  meetingsThisWeek: number;
  totalActionItems: number;
  totalTasksSent: number;
}

// Counts ask the database for numbers directly (head: true — no row data
// sent back at all). Home never downloads every meeting or task just to
// render its four small summary cards.
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, weekRes, actionItemsRes, tasksSentRes] = await Promise.all([
    supabase.from("meetings").select("id", { count: "exact", head: true }).is("team_id", null),
    supabase
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .is("team_id", null)
      .gte("created_at", weekAgo),
    supabase.from("action_items").select("id", { count: "exact", head: true }),
    supabase.from("task_assignments").select("id", { count: "exact", head: true }),
  ]);

  if (totalRes.error) console.error(totalRes.error);
  if (weekRes.error) console.error(weekRes.error);
  if (actionItemsRes.error) console.error(actionItemsRes.error);
  if (tasksSentRes.error) console.error(tasksSentRes.error);

  return {
    totalMeetings: totalRes.count || 0,
    meetingsThisWeek: weekRes.count || 0,
    totalActionItems: actionItemsRes.count || 0,
    totalTasksSent: tasksSentRes.count || 0,
  };
}

export type InsightsMeeting = Pick<
  SavedMeeting,
  "created_at" | "decisions" | "action_items" | "metadata" | "meeting_type" | "participants"
>;

// Insights only needs counts and derived stats, not transcript/summary text.
export async function listInsightsMeetings(since?: string): Promise<InsightsMeeting[]> {
  const supabase = await createClient();
  let query = supabase
    .from("meetings")
    .select("created_at, decisions, action_items, metadata, meeting_type, participants")
    .order("created_at", { ascending: false })
    .limit(500);

  if (since) query = query.gte("created_at", since);

  const response = await query;

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

// Action items -----------------------------------------------------------

export async function listActionItems(options?: {
  since?: string;
  limit?: number;
}): Promise<ActionItemRecord[]> {
  const supabase = await createClient();
  let query = supabase
    .from("action_items")
    .select("*, meetings(title)")
    .order("created_at", { ascending: false });

  if (options?.since) query = query.gte("created_at", options.since);
  if (options?.limit) query = query.limit(options.limit);

  const response = await query;

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data.map(function (row) {
    const meetings = row.meetings as { title?: string } | { title?: string }[] | null;
    const meetingTitle = Array.isArray(meetings) ? meetings[0]?.title : meetings?.title;
    return { ...row, meeting_title: meetingTitle || "Untitled meeting" };
  });
}

export async function listDueActionItems(today: string): Promise<ActionItemRecord[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("action_items")
    .select("*, meetings(title)")
    .eq("status", "todo")
    .not("due_date", "is", null)
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(20);

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data.map(function (row) {
    const meetings = row.meetings as { title?: string } | { title?: string }[] | null;
    const meetingTitle = Array.isArray(meetings) ? meetings[0]?.title : meetings?.title;
    return { ...row, meeting_title: meetingTitle || "Untitled meeting" };
  });
}

export async function updateActionItemStatus(
  id: string,
  status: "todo" | "done"
): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase
    .from("action_items")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return !!response.data;
}

export interface ActionItemDetailsInput {
  location?: string | null;
  photoUrl?: string | null;
  reminderAt?: string | null;
}

export async function updateActionItemDetails(
  id: string,
  input: ActionItemDetailsInput
): Promise<boolean> {
  const supabase = await createClient();
  const update: Record<string, string | null> = {};
  if (input.location !== undefined) update.location = input.location;
  if (input.photoUrl !== undefined) update.photo_url = input.photoUrl;
  if (input.reminderAt !== undefined) update.reminder_at = input.reminderAt;

  const response = await supabase.from("action_items").update(update).eq("id", id);

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return true;
}

// Documents ------------------------------------------------------------

export async function listDocuments(userId: string, limit?: number): Promise<UserDocument[]> {
  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);
  const response = await query;

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function createDocument(input: {
  userId: string;
  title: string;
  filePath: string;
  mimeType: string | null;
  folderId: string | null;
}): Promise<UserDocument | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("documents")
    .insert({
      user_id: input.userId,
      title: input.title,
      file_path: input.filePath,
      mime_type: input.mimeType,
      folder_id: input.folderId,
    })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

export interface DocumentUpdateInput {
  title?: string;
  notes?: string | null;
  folderId?: string | null;
  color?: string | null;
}

export async function updateDocument(id: string, input: DocumentUpdateInput): Promise<boolean> {
  const supabase = await createClient();
  const update: Record<string, string | null> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.notes !== undefined) update.notes = input.notes;
  if (input.folderId !== undefined) update.folder_id = input.folderId;
  if (input.color !== undefined) update.color = input.color;

  const response = await supabase.from("documents").update(update).eq("id", id).select("id").maybeSingle();

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return !!response.data;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase.from("documents").delete().eq("id", id);

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return true;
}

// Folders ----------------------------------------------------------------

export async function listFolders(userId: string): Promise<Folder[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function getDocumentFolderCounts(
  userId: string
): Promise<{ documentsCount: number; foldersCount: number }> {
  const supabase = await createClient();
  const [documents, folders] = await Promise.all([
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("folders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (documents.error) console.error(documents.error);
  if (folders.error) console.error(folders.error);

  return {
    documentsCount: documents.count || 0,
    foldersCount: folders.count || 0,
  };
}

export async function createFolder(input: {
  userId: string;
  name: string;
  parentId: string | null;
}): Promise<Folder | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("folders")
    .insert({ user_id: input.userId, name: input.name, parent_id: input.parentId })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

export interface FolderUpdateInput {
  name?: string;
  parentId?: string | null;
}

export async function updateFolder(id: string, input: FolderUpdateInput): Promise<boolean> {
  const supabase = await createClient();
  const update: Record<string, string | null> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.parentId !== undefined) update.parent_id = input.parentId;

  const response = await supabase.from("folders").update(update).eq("id", id);

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return true;
}

export async function deleteFolder(id: string): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase.from("folders").delete().eq("id", id);

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return true;
}

// Teams --------------------------------------------------------------------

export async function createTeam(userId: string, name: string): Promise<Team | null> {
  const supabase = await createClient();

  const teamResponse = await supabase
    .from("teams")
    .insert({ name, created_by: userId })
    .select()
    .single();

  if (teamResponse.error) {
    console.error(teamResponse.error);
    return null;
  }

  const memberResponse = await supabase
    .from("team_members")
    .insert({ team_id: teamResponse.data.id, user_id: userId, role: "owner" });

  if (memberResponse.error) {
    console.error(memberResponse.error);
  }

  return teamResponse.data;
}

export const listUserTeams = cache(async function listUserTeams(userId: string): Promise<Team[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("team_members")
    .select("role, teams(id, name, created_by, created_at)")
    .eq("user_id", userId);

  if (response.error) {
    console.error(response.error);
    return [];
  }

  const result: Team[] = [];

  for (const row of response.data) {
    const team = row.teams as
      | { id: string; name: string; created_by: string; created_at: string }
      | { id: string; name: string; created_by: string; created_at: string }[]
      | null;
    const t = Array.isArray(team) ? team[0] : team;
    if (!t) continue;
    result.push({
      id: t.id,
      name: t.name,
      created_by: t.created_by,
      created_at: t.created_at,
      role: row.role as "owner" | "member",
    });
  }

  return result;
});

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .order("joined_at", { ascending: true });

  if (response.error) {
    console.error(response.error);
    return [];
  }

  const service = createServiceClient();
  const withEmails = await Promise.all(
    response.data.map(async function (member) {
      try {
        const { data } = await service.auth.admin.getUserById(member.user_id);
        return { ...member, email: data.user?.email || undefined };
      } catch (err) {
        console.error(err);
        return member;
      }
    })
  );

  return withEmails;
}

export async function createTeamInvite(
  teamId: string,
  createdBy: string,
  invitedEmail?: string
): Promise<TeamInvite | null> {
  const supabase = await createClient();
  const token = crypto.randomUUID().replace(/-/g, "");

  const response = await supabase
    .from("team_invites")
    .insert({ team_id: teamId, token, invited_email: invitedEmail || null, created_by: createdBy })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

export async function getTeamInviteByToken(
  token: string
): Promise<(TeamInvite & { team_name?: string }) | null> {
  const service = createServiceClient();
  const response = await service
    .from("team_invites")
    .select("*, teams(name)")
    .eq("token", token)
    .single();

  if (response.error || !response.data) {
    return null;
  }

  const teams = response.data.teams as { name?: string } | { name?: string }[] | null;
  const teamName = Array.isArray(teams) ? teams[0]?.name : teams?.name;

  return { ...response.data, team_name: teamName };
}

export async function acceptTeamInvite(
  token: string,
  userId: string
): Promise<{ teamId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id !== userId) return { error: "Sign in required." };
  const { data, error } = await supabase.rpc("accept_team_invite", { invite_token: token });
  if (error || typeof data !== "string") {
    return { error: "Couldn't join. Check that the invitation is unused and you are signed in with the invited email." };
  }
  return { teamId: data };
}

// Live sessions ------------------------------------------------------------

export async function createLiveSession(input: {
  userId: string;
  title: string;
  meetingType: MeetingType;
  scheduledStart?: string | null;
  durationMinutes?: number | null;
}): Promise<LiveSession | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("live_sessions")
    .insert({
      created_by: input.userId,
      title: input.title,
      meeting_type: input.meetingType,
      scheduled_start: input.scheduledStart || null,
      duration_minutes: input.durationMinutes || null,
    })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

// Anyone with the link can join a live session, so this only ever returns
// the handful of fields the join screen needs, via the service client,
// never the full authenticated-only row.
export async function getLiveSessionPublic(id: string): Promise<LiveSessionPublic | null> {
  const service = createServiceClient();
  const response = await service
    .from("live_sessions")
    .select("id, title, meeting_type, status, scheduled_start, duration_minutes, ended_at, created_at")
    .eq("id", id)
    .single();

  if (response.error) {
    console.error("getLiveSessionPublic failed", response.error);
    return null;
  }
  if (!response.data) {
    return null;
  }

  return {
    id: response.data.id,
    title: response.data.title,
    meetingType: response.data.meeting_type as MeetingType,
    status: response.data.status,
    scheduledStart: response.data.scheduled_start,
    durationMinutes: response.data.duration_minutes,
    endedAt: response.data.ended_at,
    createdAt: response.data.created_at,
  };
}

export async function getLiveSessionForHost(
  id: string,
  userId: string
): Promise<LiveSession | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("live_sessions")
    .select()
    .eq("id", id)
    .eq("created_by", userId)
    .single();

  if (response.error || !response.data) {
    return null;
  }

  return response.data;
}

export async function markLiveSessionInviteSent(id: string, email: string): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase
    .from("live_sessions")
    .update({ invite_email: email, invite_status: "pending" })
    .eq("id", id);

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return true;
}

// Anyone with the accept link can accept an invite, so this uses the service
// client the same way getLiveSessionPublic does (the recipient never has an
// authenticated session with this app).
export async function acceptLiveSessionInvite(id: string): Promise<LiveSession | null> {
  const service = createServiceClient();
  const response = await service
    .from("live_sessions")
    .update({ invite_status: "accepted" })
    .eq("id", id)
    .select()
    .single();

  if (response.error || !response.data) {
    return null;
  }

  return response.data;
}

export async function getHostEmail(userId: string): Promise<string | null> {
  const service = createServiceClient();
  try {
    const { data } = await service.auth.admin.getUserById(userId);
    return data.user?.email || null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function endLiveSession(id: string, meetingId: string | null): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase
    .from("live_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString(), meeting_id: meetingId })
    .eq("id", id).select("id").maybeSingle();

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return !!response.data;
}

// Projects -------------------------------------------------------------

export async function createProject(input: {
  userId: string;
  name: string;
  clientName?: string | null;
  teamId?: string | null;
  dueDate?: string | null;
  dueAt?: string | null;
  timeZone?: string | null;
}): Promise<Project | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("projects")
    .insert({
      created_by: input.userId,
      name: input.name,
      client_name: input.clientName || null,
      due_date: input.dueDate || null,
      due_at: input.dueAt || null,
      time_zone: input.timeZone || null,
      team_id: input.teamId || null,
    })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

// RLS already scopes this to the caller's own projects plus any project
// belonging to a team they're a member of, so no explicit user filter here.
export async function listUserProjects(limit?: number, status?: Project["status"]): Promise<Project[]> {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (limit) query = query.limit(limit);
  const response = await query;

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const response = await supabase.from("projects").select("*").eq("id", id).single();

  if (response.error || !response.data) {
    return null;
  }

  return response.data;
}

export async function listProjectMeetings(projectId: string): Promise<LightMeeting[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("meetings")
    .select("id, title, participants, summary, decisions, action_items, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function updateProjectStatus(id: string, status: "active" | "closed"): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase.from("projects").update({ status }).eq("id", id);

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return true;
}

// Task assignments ----------------------------------------------------

export async function createTaskAssignment(input: {
  userId: string;
  recipientEmail: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  location?: string | null;
  amountCents?: number | null;
  currency?: string;
  customerEmail?: string | null;
}): Promise<TaskAssignment | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("task_assignments")
    .insert({
      created_by: input.userId,
      recipient_email: input.recipientEmail,
      title: input.title,
      description: input.description || null,
      due_date: input.dueDate || null,
      location: input.location || null,
      priority: null,
      amount_cents: input.amountCents || null,
      currency: input.currency || "aud",
      customer_email: input.customerEmail || null,
    })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

export async function listMyTaskAssignments(
  userId: string,
  limit?: number,
  since?: string,
  status?: TaskAssignment["status"]
): Promise<TaskAssignment[]> {
  const supabase = await createClient();
  let query = supabase
    .from("task_assignments")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (since) query = query.gte("created_at", since);
  if (status) query = query.eq("status", status);
  if (limit) query = query.limit(limit);

  const response = await query;

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function listDueMyTaskAssignments(
  userId: string,
  today: string
): Promise<TaskAssignment[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("task_assignments")
    .select("*")
    .eq("created_by", userId)
    .eq("status", "pending")
    .not("due_date", "is", null)
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(20);

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

// The recipient never has an authenticated session with this app, so this
// (and completeTaskAssignment below) uses the service client the same way
// live_sessions' public accept flow does.
export async function getTaskAssignmentPublic(id: string): Promise<TaskAssignment | null> {
  const service = createServiceClient();
  const response = await service.from("task_assignments").select("*").eq("id", id).single();

  if (response.error || !response.data) {
    return null;
  }

  const createdByEmail = await getHostEmail(response.data.created_by);

  return { ...response.data, createdByEmail: createdByEmail || undefined };
}

export async function completeTaskAssignment(
  id: string,
  input: { note?: string | null; fileUrl?: string | null }
): Promise<TaskAssignment | null> {
  const service = createServiceClient();
  const response = await service
    .from("task_assignments")
    .update({
      status: "done",
      completion_note: input.note || null,
      completion_file_url: input.fileUrl || null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (response.error || !response.data) {
    return null;
  }

  return response.data;
}

// Either side (sender or the account-less recipient) can post a running
// update, so this always goes through the service client the same way
// completeTaskAssignment above does.
export async function addTaskNote(
  id: string,
  note: { text: string; author: "sender" | "recipient" }
): Promise<TaskAssignment | null> {
  const service = createServiceClient();
  const existing = await service.from("task_assignments").select("notes").eq("id", id).single();

  if (existing.error || !existing.data) {
    return null;
  }

  const notes = Array.isArray(existing.data.notes) ? existing.data.notes : [];
  notes.push({ text: note.text, author: note.author, created_at: new Date().toISOString() });

  const response = await service
    .from("task_assignments")
    .update({ notes })
    .eq("id", id)
    .select()
    .single();

  if (response.error || !response.data) {
    return null;
  }

  return response.data;
}

export async function getTaskAssignmentOwnedBy(
  id: string,
  userId: string
): Promise<TaskAssignment | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("task_assignments")
    .select("*")
    .eq("id", id)
    .eq("created_by", userId)
    .single();

  if (response.error || !response.data) {
    return null;
  }

  return response.data;
}

// Notifications ---------------------------------------------------------

// Always the service client: the events that create one (a recipient with
// no account completing a task, a live session invite acceptance, a cron
// job) rarely run with the target user's own session available.
export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<boolean> {
  const service = createServiceClient();

  // Preferences default to on, so a missing or unrecognized key never
  // silently suppresses a notification type added after this shipped.
  const { data: userData } = await service.auth.admin.getUserById(input.userId);
  const prefs = userData.user?.user_metadata?.notification_prefs as
    | Record<string, boolean>
    | undefined;
  if (prefs && prefs[input.type] === false) {
    return false;
  }

  const response = await service.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body || null,
    link: input.link || null,
  });

  if (response.error) {
    console.error(response.error);
    return false;
  }
  return true;
}

export async function listMyNotifications(userId: string): Promise<Notification[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", userId);

  return !response.error;
}

export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  return !response.error;
}

// People ------------------------------------------------------------------

export async function listPeople(): Promise<Person[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("people")
    .select("*")
    .order("last_interaction_at", { ascending: false, nullsFirst: false });

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function createPerson(input: {
  userId: string;
  name: string;
  email?: string | null;
}): Promise<Person | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("people")
    .insert({ user_id: input.userId, name: input.name, email: input.email || null })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

// Commitments (I owe / they owe) -------------------------------------------

export async function listCommitments(direction?: CommitmentDirection): Promise<Commitment[]> {
  const supabase = await createClient();
  let query = supabase.from("commitments").select("*").order("due_date", { ascending: true });

  if (direction) {
    query = query.eq("direction", direction);
  }

  const response = await query;

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function listDueCommitments(today: string): Promise<Commitment[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("commitments")
    .select("*")
    .eq("status", "pending")
    .not("due_date", "is", null)
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(20);

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function createCommitment(input: {
  userId: string;
  description: string;
  direction: CommitmentDirection;
  personName?: string | null;
  personId?: string | null;
  dueDate?: string | null;
  dueAt?: string | null;
  reminderAt?: string | null;
  timeZone?: string | null;
  sourceType?: "meeting" | "task" | "manual" | "note";
  sourceId?: string | null;
}): Promise<Commitment | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("commitments")
    .insert({
      user_id: input.userId,
      description: input.description,
      direction: input.direction,
      person_name: input.personName || null,
      person_id: input.personId || null,
      due_date: input.dueDate || null,
      due_at: input.dueAt || null,
      reminder_at: input.reminderAt || null,
      time_zone: input.timeZone || null,
      priority: null,
      source_type: input.sourceType || "manual",
      source_id: input.sourceId || null,
    })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

// Reminders -----------------------------------------------------------------

export async function listReminders(): Promise<Reminder[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("reminders")
    .select("*")
    .order("remind_at", { ascending: true });

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function listDueReminders(now: string): Promise<Reminder[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "pending")
    .lte("remind_at", now)
    .order("remind_at", { ascending: true })
    .limit(20);

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function createReminder(input: {
  userId: string;
  title: string;
  context?: string | null;
  remindAt: string;
  relatedType?: "meeting" | "task" | "document" | "person" | null;
  relatedId?: string | null;
}): Promise<Reminder | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("reminders")
    .insert({
      user_id: input.userId,
      title: input.title,
      context: input.context || null,
      remind_at: input.remindAt,
      related_type: input.relatedType || null,
      related_id: input.relatedId || null,
    })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

export async function updateReminderStatus(
  id: string,
  status: "done" | "dismissed"
): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase.from("reminders").update({ status }).eq("id", id);

  return !response.error;
}

// Notes -----------------------------------------------------------------

export async function listNotes(): Promise<Note[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function createNote(input: {
  userId: string;
  title?: string | null;
  body: string;
}): Promise<Note | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("notes")
    .insert({ user_id: input.userId, title: input.title || null, body: input.body })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

// RLS restricts both of these to the caller's own notes, so no explicit
// user filter — a note that isn't theirs simply isn't matched.
export async function updateNote(
  id: string,
  input: { title?: string | null; body: string }
): Promise<Note | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("notes")
    .update({ title: input.title || null, body: input.body })
    .eq("id", id)
    .select()
    .single();

  if (response.error || !response.data) {
    if (response.error) console.error(response.error);
    return null;
  }

  return response.data;
}

export async function deleteNote(id: string): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase.from("notes").delete().eq("id", id).select("id");

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return (response.data?.length ?? 0) > 0;
}

// Sharing (MemoValet-to-MemoValet) -------------------------------------

// Resolves a MemoValet account by email, or null if they don't have one yet.
/** What can be handed to another MemoValet account. Matches the database's own check constraint. */
export type SharedItemType = "note" | "project" | "meeting";

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const service = createServiceClient();
  const target = email.trim().toLowerCase();
  try {
    // Fine at this scale; swap for an indexed profiles table when user
    // counts make paging through auth users impractical.
    let page = 1;
    for (;;) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data.users.length) return null;
      const match = data.users.find((u) => (u.email || "").toLowerCase() === target);
      if (match) return match.id;
      if (data.users.length < 1000) return null;
      page += 1;
    }
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function shareItemWithUser(input: {
  itemType: SharedItemType;
  itemId: string;
  ownerId: string;
  recipientUserId: string;
}): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase.from("shared_items").upsert(
    {
      item_type: input.itemType,
      item_id: input.itemId,
      owner_id: input.ownerId,
      shared_with_user_id: input.recipientUserId,
    },
    { onConflict: "item_type,item_id,shared_with_user_id" }
  );

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return true;
}

export async function listShareRecipients(
  itemType: SharedItemType,
  itemId: string
): Promise<{ userId: string; label: string }[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("shared_items")
    .select("shared_with_user_id")
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });

  if (response.error || !response.data) return [];

  return Promise.all(
    response.data.map(async (row) => ({
      userId: row.shared_with_user_id,
      label: (await getUserLabel(row.shared_with_user_id)) || "someone",
    }))
  );
}

// Bookmarks ---------------------------------------------------------------

export async function listBookmarks(): Promise<Bookmark[]> {
  const supabase = await createClient();
  const response = await supabase
    .from("bookmarks")
    .select("*")
    .order("created_at", { ascending: false });

  if (response.error) {
    console.error(response.error);
    return [];
  }

  return response.data;
}

export async function createBookmark(input: {
  userId: string;
  title: string;
  url: string;
}): Promise<Bookmark | null> {
  const supabase = await createClient();
  const response = await supabase
    .from("bookmarks")
    .insert({ user_id: input.userId, title: input.title, url: input.url })
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    return null;
  }

  return response.data;
}

export async function deleteBookmark(id: string): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase.from("bookmarks").delete().eq("id", id).select("id");

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return (response.data?.length ?? 0) > 0;
}

// A person's display label for UI: "First Last", else their email.
export async function getUserLabel(userId: string): Promise<string | null> {
  try {
    const service = createServiceClient();
    const { data, error } = await service.auth.admin.getUserById(userId);
    if (error || !data.user) return null;
    const meta = (data.user.user_metadata || {}) as { first_name?: string; last_name?: string };
    const name = [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim();
    return name || data.user.email || null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function getUserLabels(userIds: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(userIds));
  const entries = await Promise.all(
    unique.map(async (id) => [id, (await getUserLabel(id)) || "someone"] as const)
  );
  return Object.fromEntries(entries);
}

// Owner removes a person's access. RLS only lets the owner delete.
export async function unshareItem(input: {
  itemType: SharedItemType;
  itemId: string;
  recipientUserId: string;
}): Promise<boolean> {
  const supabase = await createClient();
  const response = await supabase
    .from("shared_items")
    .delete()
    .eq("item_type", input.itemType)
    .eq("item_id", input.itemId)
    .eq("shared_with_user_id", input.recipientUserId)
    .select("id");

  if (response.error) {
    console.error(response.error);
    return false;
  }

  return (response.data?.length ?? 0) > 0;
}

// Payments / Stripe ---------------------------------------------------------

export async function getStripeAccountLink(userId: string): Promise<StripeAccountLink | null> {
  const service = createServiceClient();
  const response = await service.from("stripe_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (response.error) {
    console.error(response.error);
    return null;
  }
  return response.data;
}

export async function upsertStripeAccountLink(input: {
  userId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}): Promise<boolean> {
  const service = createServiceClient();
  const response = await service.from("stripe_accounts").upsert(
    {
      user_id: input.userId,
      stripe_account_id: input.stripeAccountId,
      charges_enabled: input.chargesEnabled,
      details_submitted: input.detailsSubmitted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (response.error) {
    console.error(response.error);
    return false;
  }
  return true;
}

export async function findUserIdByStripeAccount(stripeAccountId: string): Promise<string | null> {
  const service = createServiceClient();
  const response = await service
    .from("stripe_accounts")
    .select("user_id")
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle();
  if (response.error || !response.data) return null;
  return response.data.user_id;
}

// Server-side (service role) update of a task's payment bookkeeping.
export async function setTaskAssignmentPayment(
  id: string,
  fields: {
    payment_status?: "none" | "pending" | "paid" | "failed";
    stripe_checkout_session_id?: string | null;
    stripe_payment_intent_id?: string | null;
    paid_at?: string | null;
  }
): Promise<boolean> {
  const service = createServiceClient();
  const response = await service.from("task_assignments").update(fields).eq("id", id);
  if (response.error) {
    console.error(response.error);
    return false;
  }
  return true;
}

export async function createPaymentRecord(input: {
  userId: string;
  taskAssignmentId: string | null;
  amountCents: number;
  currency: string;
  customerEmail: string | null;
  stripeCheckoutSessionId: string | null;
}): Promise<Payment | null> {
  const service = createServiceClient();
  const response = await service
    .from("payments")
    .upsert(
      {
        user_id: input.userId,
        task_assignment_id: input.taskAssignmentId,
        amount_cents: input.amountCents,
        currency: input.currency,
        status: "pending",
        customer_email: input.customerEmail,
        stripe_checkout_session_id: input.stripeCheckoutSessionId,
      },
      { onConflict: "stripe_checkout_session_id" }
    )
    .select()
    .single();
  if (response.error) {
    console.error(response.error);
    return null;
  }
  return response.data;
}

// Called from the Stripe webhook once the customer has paid.
export async function markPaymentPaid(input: {
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
}): Promise<{ taskAssignmentId: string | null; userId: string | null }> {
  const service = createServiceClient();
  const paidAt = new Date().toISOString();

  const payment = await service
    .from("payments")
    .update({ status: "paid", paid_at: paidAt, stripe_payment_intent_id: input.stripePaymentIntentId })
    .eq("stripe_checkout_session_id", input.stripeCheckoutSessionId)
    .select("task_assignment_id, user_id")
    .maybeSingle();

  if (payment.error) console.error(payment.error);

  const taskAssignmentId = payment.data?.task_assignment_id ?? null;
  if (taskAssignmentId) {
    await setTaskAssignmentPayment(taskAssignmentId, {
      payment_status: "paid",
      stripe_payment_intent_id: input.stripePaymentIntentId,
      paid_at: paidAt,
    });
  }

  return { taskAssignmentId, userId: payment.data?.user_id ?? null };
}

export async function listPayments(): Promise<Payment[]> {
  const supabase = await createClient();
  const response = await supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(200);
  if (response.error) {
    console.error(response.error);
    return [];
  }
  return response.data;
}
