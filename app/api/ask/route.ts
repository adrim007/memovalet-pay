import { NextResponse } from "next/server";
import { generateAIText } from "@/lib/ai/provider";
import { createClient } from "@/lib/supabase/server";
import {
  listActionItems,
  listVisibleMeetingsLight,
  listCommitments,
  listDocuments,
  listMyTaskAssignments,
  listPeople,
  listNotes,
  listUserProjects,
} from "@/lib/database";

const MAX_MEETINGS_IN_CONTEXT = 200;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const scope = ["everything", "meetings", "tasks", "projects", "documents", "people", "notes"].includes(
      body.scope
    )
      ? body.scope
      : "everything";

    if (!question || question.length > 2000) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const [meetings, actionItems, assignments, commitments, projects, documents, people, notes] =
      await Promise.all([
        scope === "everything" || scope === "meetings" ? listVisibleMeetingsLight(MAX_MEETINGS_IN_CONTEXT) : [],
        scope === "everything" || scope === "tasks" ? listActionItems({ limit: 200 }) : [],
        scope === "everything" || scope === "tasks"
          ? listMyTaskAssignments(user.id, 200)
          : [],
        scope === "everything" || scope === "tasks" ? listCommitments() : [],
        scope === "everything" || scope === "projects" ? listUserProjects() : [],
        scope === "everything" || scope === "documents" ? listDocuments(user.id) : [],
        scope === "everything" || scope === "people" ? listPeople() : [],
        scope === "everything" || scope === "notes" ? listNotes() : [],
      ]);

    const itemCount =
      meetings.length +
      actionItems.length +
      assignments.length +
      commitments.length +
      projects.length +
      documents.length +
      people.length + notes.length;

    if (itemCount === 0) {
      return NextResponse.json({
        answer:
          scope === "everything"
            ? "There isn't anything in your MemoValet memory yet. Start or import a meeting, create a task, or upload a document—then I can answer with sources."
            : `There isn't anything in ${scope} yet. Add something there first, then ask again.`,
        sources: [],
        sourceLinks: {},
        itemsSearched: 0,
      });
    }

    const sourceLinks: Record<string, string> = {};
    const meetingContext = meetings
      .slice(0, MAX_MEETINGS_IN_CONTEXT)
      .map(function (m) {
        const label = `Meeting: ${m.title}`;
        sourceLinks[label] = `/history/${m.id}`;
        const date = new Date(m.created_at).toISOString().slice(0, 10);
        const decisions = (m.decisions || []).join("; ");
        const actionItems = (m.action_items || [])
          .map(function (a) {
            return a.task + (a.owner ? " (" + a.owner + ")" : "");
          })
          .join("; ");

        return (
          "### SOURCE: " +
          label +
          " — " +
          date +
          "\n" +
          "Summary: " +
          (m.summary || "n/a") +
          "\n" +
          "Decisions: " +
          (decisions || "none") +
          "\n" +
          "Action items: " +
          (actionItems || "none")
        );
      })
      .join("\n\n");

    const taskContext = [
      ...actionItems.map((item) => {
        const label = `Task: ${item.task}`;
        sourceLinks[label] = item.meeting_id ? `/history/${item.meeting_id}` : "/tasks";
        return `### SOURCE: ${label}\nStatus: ${item.status}\nOwner: ${item.owner || "unassigned"}\nDue: ${item.due_date || "none"}\nFrom: ${item.meeting_title || "MemoValet"}`;
      }),
      ...assignments.map((item) => {
        const label = `Task sent: ${item.title}`;
        sourceLinks[label] = "/tasks";
        return `### SOURCE: ${label}\nStatus: ${item.status}\nRecipient: ${item.recipient_email}\nDue: ${item.due_date || "none"}\nDetails: ${item.description || "none"}`;
      }),
      ...commitments.map((item) => {
        const label = `Promise: ${item.description}`;
        sourceLinks[label] = `/tasks?tab=${item.direction === "i_owe" ? "i-owe" : "waiting-on"}`;
        return `### SOURCE: ${label}\nDirection: ${item.direction}\nPerson: ${item.person_name || "unspecified"}\nStatus: ${item.status}\nDue: ${item.due_date || "none"}`;
      }),
    ].join("\n\n");

    const projectContext = projects
      .map((project) => {
        const label = `Project: ${project.name}`;
        sourceLinks[label] = `/projects/${project.id}`;
        return `### SOURCE: ${label}\nClient: ${project.client_name || "none"}\nStatus: ${project.status}`;
      })
      .join("\n\n");

    const documentContext = documents
      .map((document) => {
        const label = `Document: ${document.title}`;
        sourceLinks[label] = `/documents?document=${document.id}`;
        return `### SOURCE: ${label}\nType: ${document.mime_type || document.doc_type || "file"}\nNotes: ${document.notes || "none"}`;
      })
      .join("\n\n");

    const peopleContext = people
      .map((person) => {
        const label = `Person: ${person.name}`;
        sourceLinks[label] = `/people/${encodeURIComponent(person.name)}`;
        return `### SOURCE: ${label}\nEmail: ${person.email || "none"}\nLast interaction: ${person.last_interaction_at || "unknown"}`;
      })
      .join("\n\n");

    const noteContext = notes.map(note => {
      const label = `Note: ${note.title || "Untitled"} [${note.id}]`;
      sourceLinks[label] = "/notes";
      return `### SOURCE: ${label}\nDate: ${note.created_at}\n${note.body}`;
    }).join("\n\n");
    const context = [meetingContext, taskContext, projectContext, documentContext, peopleContext, noteContext]
      .filter(Boolean)
      .join("\n\n");

    const prompt =
      "You answer questions using only the MemoValet memory below. It can contain meetings, tasks, promises, projects, documents, and people. " +
      "When you use an entry, copy its SOURCE label exactly into the sources array. " +
      "If the answer truly isn't in these notes, say so plainly, don't guess. " +
      "The notes may be in different languages across different meetings. Answer in the same language " +
      "the question is written in, translating any information you draw from notes in other languages. " +
      'Return JSON only: { "answer": string, "sources": string[] } where sources is a list of meeting titles you drew from (empty array if none).\n\n' +
      `The user selected the ${scope} scope.\n\nMemoValet memory:\n` +
      context +
      "\n\nQuestion: " +
      question;

    const rawText = await generateAIText({
      prompt,
      maxTokens: 800,
      timeoutMs: 30000,
      json: true,
    });
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = { answer: rawText, sources: [] };
    }

    return NextResponse.json({
      answer: typeof parsed?.answer === "string" ? parsed.answer : "Couldn't produce an answer. Please try again.",
      sources: Array.isArray(parsed?.sources) ? parsed.sources.filter((label: unknown) => typeof label === "string" && Object.hasOwn(sourceLinks, label)) : [],
      sourceLinks,
      meetingsSearched: meetings.length,
      itemsSearched: itemCount,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error answering your question" }, { status: 500 });
  }
}
