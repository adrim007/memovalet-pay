/**
 * Who MemoValet is for, and what it solves for each of them. Shared by the
 * Solutions page and the home page, so the two can never describe different
 * products. "icon" is a key each page maps to its own icon.
 */
export const SOLUTIONS = [
  {
    "key": "global-teams",
    "icon": "global",
    "label": "Personal organisation",
    "eyebrow": "Make space for your priorities",
    "title": "Bring your plans, ideas and responsibilities together.",
    "body": "Use one workspace to capture notes, keep important files and manage the tasks that shape your day. Your calendar helps you return to past work and see what is coming next.",
    "points": [
      "Keep personal notes and documents organised",
      "Set priorities, due dates and reminders",
      "Browse your work through the calendar"
    ],
    "result": "Spend less time searching for information and more time acting on it."
  },
  {
    "key": "sales",
    "icon": "sales",
    "label": "Clients and small businesses",
    "eyebrow": "Keep commitments visible",
    "title": "Manage client work with clear responsibilities.",
    "body": "Keep project information, supporting documents and tasks within reach. Assign work and share selected records so clients and collaborators know what happens next.",
    "points": [
      "Keep useful records for each client or project",
      "Assign tasks with deadlines and context",
      "Share task links with people outside your workspace"
    ],
    "result": "A clearer record of what needs to happen and who is responsible."
  },
  {
    "key": "product",
    "icon": "product",
    "label": "Projects and delivery",
    "eyebrow": "Turn plans into progress",
    "title": "Keep the project details connected to the work.",
    "body": "Bring tasks, notes, files and project conversations together. Review progress and keep the decisions behind the work available when people need them.",
    "points": [
      "Manage tasks with owners and due dates",
      "Keep supporting notes and files organised",
      "Review decisions and outstanding actions"
    ],
    "result": "Your team can find the context and responsibilities behind each next step."
  },
  {
    "key": "people",
    "icon": "people",
    "label": "People and collaboration",
    "eyebrow": "Work together with context",
    "title": "Keep the right people connected to the right information.",
    "body": "Organise contacts and groups, coordinate shared responsibilities and choose which records to share. Meeting captions and translation options support conversations across languages.",
    "points": [
      "Manage contacts and groups",
      "Share selected files and task details",
      "Use captions and translation in supported languages"
    ],
    "result": "People have a clearer view of the work and information relevant to them."
  },
  {
    "key": "leadership",
    "icon": "leadership",
    "label": "Team management",
    "eyebrow": "Understand what needs attention",
    "title": "See progress and outstanding responsibilities.",
    "body": "Review activity, task completion and overdue work alongside the records your team creates. Use those details to decide where support or a decision is needed.",
    "points": [
      "Review completed and overdue tasks",
      "Understand patterns in team activity",
      "Keep project information available for review"
    ],
    "result": "Make informed decisions with a clearer view of your team’s work."
  },
  {
    "key": "field-work",
    "icon": "field",
    "label": "Contractors and field work",
    "eyebrow": "Coordinate work wherever it happens",
    "title": "Send clear instructions and receive completion evidence.",
    "body": "Share a task link with the location, due date and information needed to complete the job. The person can mark it done and send back a note and a photo, without creating an account.",
    "points": [
      "Include a location that opens in a maps app",
      "Receive a completion update through the task link",
      "Keep supporting evidence with the work"
    ],
    "result": "The person doing the work knows what is expected, and you have a record of the outcome."
  }
] as const;

export type Solution = (typeof SOLUTIONS)[number];
