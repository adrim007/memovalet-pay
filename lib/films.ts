// MemoValet's two films, rendered from media-src/energy-ad (Remotion):
// the 30-second ad for the hero, and the step-by-step walkthrough for the
// dashboard section. Both show the real app (the demo account, Maya).

export type Film = {
  eyebrow: string;
  title: string;
  length?: string; // read after the button's label, e.g. "30 seconds"; the walkthrough doesn't say
  wide: string;
  tall?: string; // a cut made for a phone held upright
  poster: string;
  posterTall?: string;
  captions?: string; // left out when the words are already on screen
  description: string; // what the film shows, for anyone who can't see it
};

export const AD_FILM: Film = {
  eyebrow: "MemoValet in 30 seconds",
  title: "Everything on your plate, taken care of.",
  length: "30 seconds",
  wide: "/media/energy-ad/memovalet-energy-ad.mp4",
  tall: "/media/energy-ad/memovalet-energy-ad-vertical.mp4",
  poster: "/media/energy-ad/poster.jpg",
  posterTall: "/media/energy-ad/poster-vertical.jpg",
  captions: "/media/energy-ad/captions.vtt",
  description:
    "A 30 second film with upbeat music and a voiceover. It opens on the problem: your tasks in one app, your notes in another, your files somewhere, and a promise from Monday, gone. " +
    "Then: Meet MemoValet, your personal assistant for work and for life. The MemoValet dashboard shows your whole day on one screen, with an overdue promise and today's schedule. " +
    "Maya taps the microphone in the Ask bar and asks out loud: What did I promise to do this week? Her words appear as she speaks, and the promise due today appears. A task is sent to a contractor as a link, completed on their phone with a note and a photo, and the sender is notified. " +
    "Meetings are translated between 21 languages. Notes, files, calendar and people follow, and it ends on: Everything on your plate, taken care of. Start free at memovalet.com.",
};

export const WALKTHROUGH_FILM: Film = {
  eyebrow: "How it works, step by step",
  title: "Your MemoValet dashboard, step by step",
  wide: "/media/walkthrough/memovalet-walkthrough.mp4",
  tall: "/media/walkthrough/memovalet-walkthrough-vertical.mp4", // filmed on the phone layout
  poster: "/media/walkthrough/poster.jpg",
  posterTall: "/media/walkthrough/poster-vertical.jpg",
  description:
    "A walkthrough of the MemoValet dashboard, with a voiceover and the words on screen. " +
    "Step 1: you start on Home, which shows what needs your attention today. " +
    "Step 2: a question, What did I promise to do this week?, is typed into the box at the top and answered from your own tasks, notes and meetings, with its sources. Back on Home, the microphone in the box is pointed out: you can also tap it and just say it. " +
    "Step 3: Create is chosen and Send the proposal tomorrow at 10am is typed; MemoValet works out the day and time and adds the task. It appears in the calendar on Thursday at 10:00, and in Work its priority is set to high (it can be high, medium or low). " +
    "Step 4: Needs you lists what's overdue, what's due today and who owes what. " +
    "Step 5: Up next shows the work in progress and today's schedule, with a link to join a call. " +
    "Step 6: a job is sent to someone by email; they open the link on their phone without an account, add a note and a photo, and mark it done, and you get an email and a notification. " +
    "Step 7: Meetings, Library and People are in the menu on the left. " +
    "Step 8: the Tour button gives a guided look around whenever you want it.",
};
