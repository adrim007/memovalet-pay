/**
 * Which of the two ways of writing down speech a call should be using.
 *
 * The browser's own recognition is instant and free, and it is what you want
 * while someone is simply reading captions in the language being spoken. It is
 * also rough: no punctuation, and it mishears ("in our laps in canned or in
 * judgment"). That is survivable when a person is reading it, because a person
 * fills in the gaps.
 *
 * A translator cannot. Rough words in, rough translation out — and the mistake
 * arrives in a language the reader can't check against what was said. So when
 * translation is on, MemoValet's own transcription does the writing: slower by
 * a second or two, but it hears the words properly, punctuates them, and knows
 * which language they were in.
 */
export type CaptionEngine = "browser" | "memovalet";

export function captionEngineFor(state: {
  /** The browser has speech recognition at all (Chrome and Edge do; Firefox doesn't). */
  browserRecognition: boolean;
  /** It has already failed or heard nothing this call. */
  browserFailed: boolean;
  /** Someone is reading the call in another language. */
  translationOn: boolean;
  /** MemoValet can listen: an audio pipeline and a live microphone track. */
  canListen: boolean;
}): CaptionEngine {
  if (!state.canListen) return "browser";
  if (!state.browserRecognition || state.browserFailed) return "memovalet";
  return state.translationOn ? "memovalet" : "browser";
}
