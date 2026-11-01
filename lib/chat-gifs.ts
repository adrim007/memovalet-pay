import { searchWords, wordMatches } from "@/lib/chat-search";

/**
 * The GIFs a meeting's chat offers, ready to click — the way Teams and Zoom do
 * it, instead of asking people to go and find a link and paste it in.
 *
 * Each one was looked at frame by frame before it went in, because these play
 * in front of clients. Out went single-frame images that don't move, one that
 * flashes black at the end of every loop, the drink-spitting and the champagne,
 * and Pepe the Frog, which carries hate-symbol associations whatever the
 * particular one shows. What is left is friendly, legible and business-safe.
 *
 * Previews are Tenor's small animated WebP (about a tenth of the size) so
 * opening the picker mid-call doesn't compete with the video. What gets sent is
 * the .gif, which is what the receiving side validates.
 */

export interface ChatGif {
  /** Stable key: Tenor's id for it. */
  key: string;
  /** What it says, for the tile and for a screen reader. */
  label: string;
  /** What people might type to find it. */
  words: string;
  /** Light animated preview for the picker. */
  preview: string;
  /** The .gif that is actually sent. */
  url: string;
}

export interface GifGroup {
  name: string;
  gifs: ChatGif[];
}

const TENOR = "https://media.tenor.com/";

function gif(key: string, file: string, label: string, words: string): ChatGif {
  return {
    key,
    label,
    words: `${label.toLowerCase()} ${words}`,
    preview: `${TENOR}${key}AAAA1/${file}.webp`,
    url: `${TENOR}${key}AAAAM/${file}.gif`,
  };
}

export const GIF_GROUPS: GifGroup[] = [
  {
    name: "Yes & thanks",
    gifs: [
      gif("5mz5YYozfco", "cat-thumbs-up", "Thumbs up", "yes thumbs up agree ok good great"),
      gif("3jeDLKfNidU", "cute", "Thank you", "thank thanks grateful cute"),
      gif("7718qSlbuEA", "thank-you-thank-you-very-much", "Thank you", "thank thanks rose grateful"),
      gif("mCKD8UN99Rs", "heck-yeah", "Heck yeah", "yes yeah agree agreed heck cat"),
      gif("X4GM3oehGBY", "yeah-yes", "Yes", "yes yeah agree agreed nod nodding"),
      gif("LCa7LcdVIeI", "grandma-nod", "Nodding", "yes agree agreed nod nodding right"),
      gif("c2bO9wKzyTw", "sassy-nodding", "Nodding yes", "yes agree agreed nod nodding sure"),
      gif("zsMd4LjZABc", "chefs-kiss-french-chef", "Chef's kiss", "perfect chefs kiss excellent brilliant nice"),
    ],
  },
  {
    name: "Applause",
    gifs: [
      gif("3J-dqHggdLw", "applause-clapping", "Applause", "applause clap clapping well done bravo"),
      gif("52m2xgRJeSg", "clapping-clap", "Standing ovation", "applause clap clapping ovation crowd bravo"),
      gif("8W3HSc4prfo", "benjammins-round-of-applause", "Round of applause", "applause clap clapping round well done"),
    ],
  },
  {
    name: "Congratulations",
    gifs: [
      gif("Twpbh1jgXD4", "congratulations-congrats", "Congratulations", "congrats congratulations well done celebrate confetti"),
      gif("lpOp1bLjz74", "congrats-congratulation", "Congratulations", "congrats congratulations well done you did it"),
      gif("iao8an9eKGk", "congratulations", "Congratulations", "congrats congratulations confetti celebrate"),
      gif("QPlD1onmI6c", "rsv", "Flowers", "congratulations thank you flowers roses well done"),
    ],
  },
  {
    name: "Good job",
    gifs: [
      gif("hKubVH1SkLg", "pat-good", "Good job", "good job well done pat on the back nice work"),
      gif("ignr5EjBXO8", "mms-mms-family", "Great job", "great job good well done nice work smiley"),
      gif("6Vi63pX5RSY", "great-job-gif-greatjob", "Great job", "great job good well done nice work thumbs up"),
      gif("HkvaFNcrTeU", "dechinezen-good-job", "Good job", "good job well done nice work"),
    ],
  },
  {
    name: "Hello & welcome",
    gifs: [
      gif("2if4lbc8gYs", "forrest-gump", "Waving", "hello hi wave waving bye"),
      gif("33q0qid9V9s", "emoji-emoji-hello", "Hello", "hello hi wave waving"),
      gif("6N0BEfFvYs0", "hi-hello", "Hi", "hello hi wave waving"),
      gif("LeKD0Zq_ehw", "my-pleasure-youre-welcome", "You're welcome", "welcome youre my pleasure penguin"),
      gif("VYzeMgXGU-g", "milk-mocha", "Welcome", "welcome hug bear happy glad"),
      gif("OUqUqFRul78", "welcome-welcome-back", "Welcome back", "welcome back hello good to see you"),
      gif("9Wyb_d4bVHI", "kitty-cute", "You're welcome", "welcome youre no problem cute"),
    ],
  },
  {
    name: "Teamwork",
    gifs: [
      gif("qy_WcGdRzfg", "xluna-high-five", "High five", "high five well done team nice"),
      gif("q6zARzwunDk", "teamwork", "High five", "high five team teamwork office well done"),
      gif("Q1Gwx9oIV8M", "tag", "Teamwork", "teamwork team together work"),
      gif("sPCIxVYTmlM", "squad-team", "Teamwork", "teamwork team together squad penguins"),
    ],
  },
  {
    name: "Celebrate",
    gifs: [
      gif("-tVKq_zc-TE", "celebrate-celebrate-good-times", "Celebrate", "celebrate party yay congratulations dance"),
      gif("-F5UrW9rgpo", "memes", "Celebrate", "celebrate party yay congratulations birthday"),
    ],
  },
  {
    name: "Let's go",
    gifs: [
      gif("2PZJreb1xAo", "funny-cat-cat", "Let's go", "lets go excited ready start dance"),
      gif("5DTTQ-KQDZM", "pengu-pudgy", "Let's go", "lets go excited ready start"),
      gif("A0jYwaG8S5Q", "college-life-college-life-shorts", "Let's gooo", "lets go excited ready hype"),
    ],
  },
  {
    name: "Laughing",
    gifs: [
      gif("M5eeMI-sp7g", "funny", "Laughing", "laugh laughing funny lol haha cat"),
      gif("Se-deMV899g", "baby-laughing-baby", "Laughing", "laugh laughing funny lol haha baby"),
    ],
  },
  {
    name: "Mind blown",
    gifs: [
      gif("3xoRK7hFE3g", "patrick-star-spongebob-squarepants", "Mind blown", "mind blown wow amazing shocked"),
      gif("5rlvFkCJv3U", "overthinking-problem", "Mind blown", "mind blown wow amazing shocked"),
      gif("3eIvVsG3yPY", "the-universe-tim-and-eric-mind-blown", "Mind blown", "mind blown wow amazing universe"),
    ],
  },
  {
    name: "Bright idea",
    gifs: [
      gif("TpZVRh7hVHg", "light-bulb-pudgy-penguins", "Bright idea", "idea light bulb good idea thought penguin"),
      gif("mcVtyzOOV5Q", "lig", "Light bulb", "idea light bulb good idea thought"),
      gif("2qZGJY7WA7I", "emoji-good-idea", "Good idea", "idea good thought bright emoji"),
    ],
  },
  {
    name: "Thinking & questions",
    gifs: [
      gif("USz8xYPUUTo", "i-have-a-question-cat-confused", "I have a question", "question ask quick one cat"),
      gif("hzEXkJq1R4M", "shrug", "I have a question", "question ask quick one"),
      gif("LuZNTBKQ6dk", "thinking-think", "Thinking", "thinking think hmm considering emoji"),
      gif("hxY0c0sHYx0", "monkey-thinking-monkey", "Hmm", "thinking think hmm considering monkey"),
    ],
  },
  {
    name: "Sorry",
    gifs: [
      gif("I_FdpKEGUEA", "sad-sappy", "I'm sorry", "sorry apologies my bad oops"),
      gif("wWerB2KmHSM", "angry-bubu", "Sorry", "sorry apologies my bad oops bear"),
      gif("MXhgLF7-FwA", "sorry", "Sorry", "sorry apologies my bad oops"),
    ],
  },
  {
    name: "No, oops & waiting",
    gifs: [
      gif("4L-wspHUohM", "no-annn3bad", "No way", "no nope way disagree"),
      gif("0SyZFIR7vv8", "facepalm-face", "Facepalm", "facepalm oops mistake ugh embarrassed"),
      gif("1pLUCAkpcfo", "9", "Facepalm", "facepalm oops mistake ugh baby"),
      gif("-jaBKz51t-A", "good-morning", "Waiting", "waiting wait patient still"),
      gif("5TJ6tYE4czs", "missing-you-no-texts", "Waiting", "waiting wait patient message"),
      gif("ASAsHQNVvac", "midnight-the-cat-stopped-working-midnight-the-cat", "Frozen", "frozen stuck lag lagging loading buffering connection"),
    ],
  },
  {
    name: "Hurry & waiting",
    gifs: [
      gif("Kqchj2GB9y8", "hurry-flork", "Hurry", "hurry quick fast rush hurry up"),
      gif("XtHhBIXYNS0", "chop-chop-hurry", "Chop chop", "hurry quick fast rush chop penguin"),
      gif("HUM-S1k3PzI", "waiting", "Still waiting", "waiting wait still patient skeleton"),
    ],
  },
  {
    name: "Coffee & Friday",
    gifs: [
      gif("QBO_RQ-3BLk", "coffee-coffee-cup", "Coffee time", "coffee break time cup tea morning"),
      gif("zEK01hHoDM4", "coffee-time-fist-bump", "Coffee time", "coffee break time cup fist bump morning"),
      gif("rPM3RCsvE3w", "mv99-natal", "My coffee", "coffee break cup morning"),
      gif("62p3_HNG9LU", "happy-friday-images-happy-friday", "Happy Friday", "friday happy weekend"),
    ],
  },
  {
    name: "Goodbye",
    gifs: [
      gif("KhPKoEtapek", "bye-waving", "Bye bye", "bye goodbye see you later wave"),
      gif("XRqxaSfa-78", "wave-waving", "Wave goodbye", "bye goodbye see you later wave smiley"),
    ],
  },
];

export const ALL_GIFS = GIF_GROUPS.flatMap((group) => group.gifs);

const BUILT_IN = new Set(ALL_GIFS.map((item) => item.url));

/**
 * One of ours. These play straight away when they arrive, the way they would
 * in Teams; anything else still waits for a click, since loading it tells a
 * third party the viewer is there.
 */
export function isBuiltInGif(url: string | undefined): boolean {
  return !!url && BUILT_IN.has(url);
}

/** Groups narrowed to a search; empty search gives everything back. */
export function searchGifs(query: string): GifGroup[] {
  const words = searchWords(query);
  if (!words.length) return GIF_GROUPS;
  return GIF_GROUPS.map((group) => ({
    name: group.name,
    gifs: group.gifs.filter((item) => words.every((word) => wordMatches(item.words, word))),
  })).filter((group) => group.gifs.length > 0);
}
