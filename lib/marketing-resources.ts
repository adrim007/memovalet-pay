import { SPEECH_LANGUAGE_OPTIONS } from "./speechRecognition";

export type ResourceCategory = "Comparisons" | "Guides";

export type FeaturedResource = {
  slug: string;
  category: ResourceCategory;
  title: string;
  body: string;
  gradient: string;
};

export const featuredResources: FeaturedResource[] = [
  {
    "slug": "getting-started",
    "category": "Guides",
    "title": "Your first steps with MemoValet",
    "body": "Create your workspace, plan a task and give your notes and files a place to belong.",
    "gradient": "linear-gradient(135deg, #4338ca 0%, #9333ea 55%, #ec4899 100%)"
  },
  {
    "slug": "organise-your-library",
    "category": "Guides",
    "title": "Build a library for your work",
    "body": "Organise notes, files and conversations so you can return to the information you need.",
    "gradient": "linear-gradient(135deg, #0ea5e9 0%, #22d3ee 55%, #818cf8 100%)"
  },
  {
    "slug": "delegate-work",
    "category": "Guides",
    "title": "Assign work with confidence",
    "body": "Share clear instructions and receive updates from clients, colleagues and contractors.",
    "gradient": "linear-gradient(135deg, #f97316 0%, #ec4899 55%, #fde047 100%)"
  }
];

export function buildResources(): { slug: string; category: ResourceCategory; title: string; body: string; readingTime: string }[] {
  return [
  {
    "slug": "product-teams",
    "category": "Guides",
    "title": "Keep project work connected",
    "body": "Bring project tasks, supporting records and decisions together.",
    "readingTime": "3 min read"
  },
  {
    "slug": "team-plan-overview",
    "category": "Guides",
    "title": "Coordinate work with your team",
    "body": "Use contacts, groups and clear responsibilities to support collaboration.",
    "readingTime": "3 min read"
  },
  {
    "slug": "calendar-history",
    "category": "Guides",
    "title": "Plan ahead and revisit past work",
    "body": "Use your calendar to browse dates and return to previous activity.",
    "readingTime": "3 min read"
  },
  {
    "slug": "guide-translation",
    "category": "Guides",
    "title": "Use captions and translation",
    "body": "Support conversations across the languages available in MemoValet.",
    "readingTime": "3 min read"
  },
  {
    "slug": "supported-languages",
    "category": "Guides",
    "title": "Explore supported languages",
    "body": "Find the languages available for speech and translation.",
    "readingTime": "3 min read"
  },
  {
    "slug": "vs-otter",
    "category": "Comparisons",
    "title": "Choosing a workspace or a transcription tool",
    "body": "Consider your everyday work as well as your meeting records.",
    "readingTime": "3 min read"
  }
];
}

// Long-form content for a resource. Previously this lived inside the
// /resources/[slug] page, which meant it could only ever be shown by
// navigating away. Keeping it here lets the library open it in a dialog
// and the standalone page render the same thing for direct links.
export type ResourceDetail =
  | {
      kind: "comparison";
      intro: string;
      competitor: string;
      rows: { feature: string; other: boolean | "partial" }[];
    }
  | {
      kind: "guide";
      intro: string;
      steps: { title: string; body: string }[];
      benefits: string[];
      benefitsHeading?: string;
    }
  | { kind: "overview"; covers: string[]; takeaway: string; heading?: string };

const resourceDetails: Record<string, ResourceDetail> = {
  "getting-started": {
    "kind": "guide",
    "intro": "MemoValet is a workspace for the information and responsibilities that make up your day. Start with one useful task, then build your workspace around the way you work.",
    "steps": [
      {
        "title": "Create your account",
        "body": "Sign up, complete your profile and choose Personal or Business to suit your work."
      },
      {
        "title": "Explore your Home dashboard",
        "body": "Use Show me around for a guided introduction. Home brings useful shortcuts and current priorities together."
      },
      {
        "title": "Add your first task",
        "body": "Open Work and create a task. Add a due date, priority and the information needed to complete it."
      },
      {
        "title": "Save something useful",
        "body": "Add a note or file and use Library to organise the records you want to keep."
      },
      {
        "title": "Review your calendar",
        "body": "Open Calendar to browse dates, review activity and return to previous work."
      }
    ],
    "benefitsHeading": "What this helps you do",
    "benefits": [
      "Start with tasks, notes or files without holding a meeting",
      "Use the guided tour whenever you need a reminder",
      "Build your workspace gradually"
    ]
  },
  "organise-your-library": {
    "kind": "guide",
    "intro": "Your library brings saved information into a place you can return to. Organise it around the clients, projects and ideas that matter to you.",
    "steps": [
      {
        "title": "Save the information",
        "body": "Create a note, upload a file or save a conversation record."
      },
      {
        "title": "Group related records",
        "body": "Use spaces to organise library items around a client, project or topic. Use folders to organise documents."
      },
      {
        "title": "Return to the context",
        "body": "Browse your library and calendar to find records from earlier work."
      },
      {
        "title": "Share selectively",
        "body": "Use the available sharing controls to share the specific item someone needs."
      }
    ],
    "benefitsHeading": "What this helps you do",
    "benefits": [
      "Keep useful records together",
      "Return to earlier work with its context",
      "Reduce time spent searching through separate records"
    ]
  },
  "delegate-work": {
    "kind": "guide",
    "intro": "Clear instructions make it easier for someone else to complete a task. MemoValet lets you share the work and keep the response with it.",
    "steps": [
      {
        "title": "Describe the task",
        "body": "Include the expected outcome, due date and any supporting context."
      },
      {
        "title": "Add a location if needed",
        "body": "Give the recipient a location they can open in a maps app."
      },
      {
        "title": "Share the task link",
        "body": "Send the task link to the person doing the work. Recipients can respond without creating a MemoValet account."
      },
      {
        "title": "Review the result",
        "body": "Check the completion update and any notes, photos, videos or files returned with it."
      }
    ],
    "benefitsHeading": "What this helps you do",
    "benefits": [
      "Set expectations before work begins",
      "Coordinate with people outside your workspace",
      "Keep a record of completion"
    ]
  },
  "calendar-history": {
    "kind": "guide",
    "intro": "The calendar helps you see work in the context of time. Use it to plan ahead and revisit activity from previous dates.",
    "steps": [
      {
        "title": "Open Calendar",
        "body": "Choose Calendar from your workspace or Library navigation."
      },
      {
        "title": "Choose a date",
        "body": "Change the month or year and select the date you want to review."
      },
      {
        "title": "Review the activity",
        "body": "Open the available items for that date to return to the relevant work."
      },
      {
        "title": "Return to today",
        "body": "Use the current date to bring your attention back to your present priorities."
      }
    ],
    "benefitsHeading": "What this helps you do",
    "benefits": [
      "Browse work by date",
      "Return to previous activity",
      "Keep past and upcoming work within reach"
    ]
  },
  "product-teams": {
    "kind": "guide",
    "intro": "Project work needs more than a conversation record. Keep the tasks, supporting files and decisions organised so the next person can understand what needs to happen.",
    "steps": [
      {
        "title": "Set up the work",
        "body": "Create a project and define the tasks needed to move it forward."
      },
      {
        "title": "Make responsibilities clear",
        "body": "Add owners, priorities and due dates where appropriate."
      },
      {
        "title": "Keep supporting records",
        "body": "Save notes and documents in your library, grouped around the project."
      },
      {
        "title": "Capture useful conversations",
        "body": "When a meeting is needed, review its summary and actions before sharing the record."
      }
    ],
    "benefitsHeading": "What this helps you do",
    "benefits": [
      "Make responsibilities visible",
      "Keep the reasons behind decisions available",
      "Review outstanding work"
    ]
  },
  "team-plan-overview": {
    "kind": "guide",
    "intro": "Use MemoValet to keep people, responsibilities and useful records organised as your team works together.",
    "steps": [
      {
        "title": "Organise your people",
        "body": "Open People to manage your contacts and groups."
      },
      {
        "title": "Set clear responsibilities",
        "body": "Assign tasks with the information and deadlines needed to complete them."
      },
      {
        "title": "Keep useful records",
        "body": "Organise notes, files and conversation records around the work they support."
      },
      {
        "title": "Review progress",
        "body": "Use Work and Insights to review activity, completion and items that need attention."
      }
    ],
    "benefitsHeading": "What this helps you do",
    "benefits": [
      "Coordinate shared responsibilities",
      "Share selected records with the right people",
      "Keep outstanding work visible"
    ]
  },
  "guide-translation": {
    "kind": "guide",
    "intro": "Captions and translation can help participants follow a conversation. Choose the options available for your session and review important details before acting on them.",
    "steps": [
      {
        "title": "Prepare your session",
        "body": "Open Meetings and select the recording or live session option that suits the conversation."
      },
      {
        "title": "Choose your languages",
        "body": "Set the speech and caption languages using the available controls."
      },
      {
        "title": "Follow the conversation",
        "body": "Read the captions during the session. Their accuracy can vary with audio quality and speech."
      },
      {
        "title": "Review the record",
        "body": "Check names, decisions and action items in the transcript and summary before sharing them."
      }
    ],
    "benefitsHeading": "What this helps you do",
    "benefits": [
      "Support conversations across languages",
      "Keep a record for later reference",
      "Review important details before sharing"
    ]
  },
  "vs-otter": {
    "kind": "overview",
    "heading": "Choose around your everyday work",
    "covers": [
      "The tasks and projects you need to manage",
      "The notes and files you want to keep organised",
      "Calendar access to current and past work",
      "How clients and colleagues will receive assignments",
      "The recording, transcription and language options you need"
    ],
    "takeaway": "MemoValet combines tasks, projects, notes, files, calendar history and conversation records in one workspace. If transcription is your main requirement, compare current language support, recording methods and pricing directly with each provider. Choose the product that fits the work you need to do."
  }
};

export function buildResourceDetail(slug: string): ResourceDetail {
  if (slug === "supported-languages") {
    return { kind: "overview", heading: `All ${SPEECH_LANGUAGE_OPTIONS.length} languages`, covers: SPEECH_LANGUAGE_OPTIONS.map((option) => option.label), takeaway: "Choose from the speech and translation languages available in MemoValet. Check the options offered in your session and review important details in the resulting record." };
  }
  return resourceDetails[slug] ?? { kind: "overview", covers: ["Organise your information", "Plan your responsibilities", "Coordinate with others"], takeaway: "Start with the work you need to do and build your workspace around it." };
}
