/**
 * The emoji offered in a meeting's chat.
 *
 * Twelve of them used to sit in one unlabelled row, which covered "yes", "ha"
 * and "thanks" and nothing else — no way to say sorry, or hang on, or that
 * something is broken. This is a curated set rather than the whole Unicode
 * table: a full picker means a library and a megabyte of it, and nobody in a
 * meeting is hunting for the aubergine. Every one carries a name so it can be
 * searched and read aloud by a screen reader.
 */

import { searchWords, wordMatches } from "@/lib/chat-search";

export interface EmojiGroup {
  name: string;
  emoji: { char: string; name: string }[];
}

const group = (name: string, pairs: [string, string][]): EmojiGroup => ({
  name,
  emoji: pairs.map(([char, label]) => ({ char, name: label })),
});

export const EMOJI_GROUPS: EmojiGroup[] = [
  group("Reactions", [
    ["\u{1F44D}", "thumbs up yes agree"],
    ["\u{1F44E}", "thumbs down no disagree"],
    ["\u{1F44F}", "applause clap well done"],
    ["\u{1F64C}", "celebrate praise hooray"],
    ["\u{1F389}", "party celebrate congratulations"],
    ["✅", "done tick complete yes"],
    ["❌", "no cross wrong"],
    ["❗", "important urgent"],
    ["❓", "question unsure"],
    ["\u{1F440}", "eyes looking watching"],
    ["\u{1F525}", "fire great brilliant"],
    ["\u{1F4AF}", "hundred exactly agreed"],
  ]),
  group("Faces", [
    ["\u{1F600}", "grin happy"],
    ["\u{1F603}", "smile happy"],
    ["\u{1F60A}", "smile pleased"],
    ["\u{1F602}", "laugh crying funny"],
    ["\u{1F923}", "rolling laughing hilarious"],
    ["\u{1F609}", "wink joking"],
    ["\u{1F60E}", "cool sunglasses"],
    ["\u{1F914}", "thinking hmm"],
    ["\u{1F610}", "neutral no comment"],
    ["\u{1F62C}", "grimace awkward"],
    ["\u{1F605}", "relief phew close"],
    ["\u{1F622}", "sad crying"],
    ["\u{1F62D}", "sobbing very sad"],
    ["\u{1F631}", "shocked scream"],
    ["\u{1F644}", "eye roll"],
    ["\u{1F634}", "sleepy tired bored"],
    ["\u{1F92F}", "mind blown"],
    ["\u{1F973}", "party face celebrating"],
  ]),
  group("Hands", [
    ["\u{1F44B}", "hello wave hi bye"],
    ["\u{1F91D}", "handshake deal agreed"],
    ["\u{1F64F}", "thank you please pray"],
    ["\u{1F44C}", "ok perfect fine"],
    ["✌️", "peace victory"],
    ["\u{1F91E}", "fingers crossed hoping"],
    ["\u{1F4AA}", "strong effort"],
    ["✋", "stop wait hold on"],
    ["\u{1F91A}", "raise hand me question"],
    ["\u{1F447}", "point down below"],
    ["\u{1F446}", "point up above"],
    ["\u{1F44A}", "fist bump nice"],
  ]),
  group("Hearts", [
    ["❤️", "love heart red"],
    ["\u{1F49C}", "purple heart"],
    ["\u{1F49A}", "green heart"],
    ["\u{1F499}", "blue heart"],
    ["\u{1F49B}", "yellow heart"],
    ["\u{1F494}", "broken heart"],
    ["✨", "sparkles lovely new"],
    ["\u{1F31F}", "star great"],
  ]),
  group("Work", [
    ["\u{1F4A1}", "idea suggestion"],
    ["\u{1F4DD}", "note write down"],
    ["\u{1F4C5}", "calendar date schedule"],
    ["⏰", "alarm deadline time"],
    ["⏳", "waiting hourglass"],
    ["\u{1F4C8}", "chart up growth"],
    ["\u{1F4C9}", "chart down decline"],
    ["\u{1F4B0}", "money budget cost"],
    ["\u{1F4CC}", "pin important"],
    ["\u{1F517}", "link url"],
    ["\u{1F4CE}", "attachment file"],
    ["\u{1F680}", "launch ship go"],
    ["\u{1F41B}", "bug broken issue"],
    ["\u{1F527}", "fix tool repair"],
    ["\u{1F6A7}", "in progress work blocked"],
    ["☕", "coffee break"],
  ]),
  group("Everyday", [
    ["\u{1F44B}\u{1F3FD}", "wave hand"],
    ["\u{1F3E0}", "home house"],
    ["\u{1F697}", "car driving travel"],
    ["✈️", "plane flight travel"],
    ["\u{1F355}", "pizza food lunch"],
    ["\u{1F37B}", "cheers drinks"],
    ["\u{1F382}", "birthday cake"],
    ["\u{1F381}", "gift present"],
    ["☀️", "sun sunny weather"],
    ["\u{1F327}️", "rain wet weather"],
    ["\u{1F4F7}", "photo camera picture"],
    ["\u{1F3B5}", "music sound"],
  ]),
];

/** Every emoji, flattened — for counting and for an unfiltered grid. */
export const ALL_EMOJI = EMOJI_GROUPS.flatMap((entry) => entry.emoji);

function matches(item: { char: string; name: string }, word: string): boolean {
  return item.char === word || wordMatches(item.name, word);
}

/**
 * Groups narrowed to a search. An empty search gives everything back, so the
 * picker has one code path whether or not someone is typing.
 */
export function searchEmoji(query: string): EmojiGroup[] {
  const words = searchWords(query);
  if (!words.length) return EMOJI_GROUPS;
  return EMOJI_GROUPS.map((entry) => ({
    name: entry.name,
    emoji: entry.emoji.filter((item) => words.every((word) => matches(item, word))),
  })).filter((entry) => entry.emoji.length > 0);
}
