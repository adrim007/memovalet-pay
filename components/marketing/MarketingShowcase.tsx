import MeetingBriefShowcase from "./MeetingBriefShowcase";
import ExpandableFeatureGrid, { type ExpandableFeature } from "./ExpandableFeatureGrid";
import MeetingWorkspace from "./MeetingWorkspace";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";

function buildOverviewItems() {
  return [
  {
    "key": "planning",
    "title": "Plan your day with a clearer view",
    "body": "See upcoming work and return to past activity through your calendar.",
    "detail": "Use your calendar to understand what is coming up and revisit work from an earlier date. Keep your schedule and saved information close together.",
    "bullets": [
      "Browse your work by date, month or year.",
      "Review upcoming responsibilities.",
      "Return to the records you need from previous days."
    ]
  },
  {
    "key": "actions",
    "title": "Give every task a clear next step",
    "body": "Manage tasks and projects with owners, due dates and priorities.",
    "detail": "Bring personal responsibilities and shared work into one place. Add the context people need, decide who is responsible and track progress as the work moves forward.",
    "bullets": [
      "Set an owner, due date and priority.",
      "Add reminders or a location when needed.",
      "Review progress and identify overdue work."
    ]
  },
  {
    "key": "documents",
    "title": "Build a library you can return to",
    "body": "Keep notes, files and saved conversations organised around your work.",
    "detail": "Give your information a useful home. Group related records into spaces and keep documents in folders so it is easier to return to a client, project or idea.",
    "bullets": [
      "Save notes and upload supporting files.",
      "Organise records into spaces and folders.",
      "Share selected items with the people who need them."
    ]
  },
  {
    "key": "sharing",
    "title": "Coordinate with clients and contractors",
    "body": "Send a task link so someone can respond without creating an account.",
    "detail": "Make the work clear from the start. Share the task, due date and location, then receive an update and supporting evidence when it is completed.",
    "bullets": [
      "Share a task through a simple link.",
      "Receive a note and a photo when it is done.",
      "Keep completion evidence with the assigned work."
    ]
  },
  {
    "key": "insights",
    "title": "Keep people and progress in view",
    "body": "Bring contacts, groups and useful insights into your everyday workspace.",
    "detail": "Keep track of the people you work with and review patterns across your activity. Use that context to decide what needs attention next.",
    "bullets": [
      "Keep contacts and groups organised.",
      "Review completed and overdue work.",
      "See activity and collaboration patterns."
    ]
  },
  {
    "key": "conversations",
    "title": "Make conversations part of the record",
    "body": "Meet, capture notes and review summaries alongside your other work.",
    "detail": "When you need to talk through a project, use meeting tools with captions and translation options. Review the resulting summary and action items before sharing them.",
    "bullets": [
      "Use supported caption and translation languages.",
      "Review summaries, decisions and suggested actions.",
      "Keep the conversation available in your library."
    ]
  }
] satisfies ExpandableFeature[];
}

/**
 * Everything around the meeting: tasks, library, calendar, people. It opened
 * the page before, which made MemoValet read as a generic workspace; it now
 * follows the meeting story, as what the meeting leads to.
 */
export function WorkspaceFeatures() {
  const overviewItems = buildOverviewItems();
  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28" aria-labelledby="overview-heading">
      <div className="pointer-events-none absolute left-[-14rem] top-[-6rem] h-[30rem] w-[30rem] rounded-full bg-indigo-500/12 blur-[150px]" />
      <div className="pointer-events-none absolute bottom-[-10rem] right-[-12rem] h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/10 blur-[150px]" />
      <div className="mx-auto max-w-6xl">
        <div className="max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8071ff]">Beyond the meeting</p>
          <h2 id="overview-heading" className="mt-5 font-display text-3xl font-light leading-[1.16] tracking-[-0.045em] text-balance text-white sm:text-5xl">
            Everything the meeting leads to, <span className="text-[#bb99ff]">in one place.</span>
          </h2>
        </div>

        <ExpandableFeatureGrid items={overviewItems} />
      </div>
    </section>
  );
}

/** The meeting itself: the call with its notes, then the brief it produces. */
export default function MarketingShowcase() {
  return (
    <>
      <div className="memo-overview-product">
        <section className="mf-featured-resource" aria-labelledby="featured-resource-heading">
          <div className="mf-featured-copy">
            <span className="mf-featured-kicker"><Sparkle size={15} weight="fill" /> Collaboration with context</span>
            <h2 id="featured-resource-heading">Bring people together.<br /><span>Keep the details connected.</span></h2>
            <p>When work needs a conversation, meet in MemoValet. Use captions and shared notes, then keep decisions and tasks available for the work that follows.</p>
            <a href="#live-product" className="mf-featured-link">Explore a meeting example <ArrowRight size={18} /></a>
          </div>
          <MeetingWorkspace className="mf-featured-workspace" />
        </section>
      </div>
      <MeetingBriefShowcase />
    </>
  );
}
