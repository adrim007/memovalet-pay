// The part of an answer that is read aloud. Like Alexa, the voice gives the gist in a sentence or
// two and the screen holds the detail, so long answers end with a pointer to the screen.
export function spokenSummary(answer: string, limit = 220): string {
  const plain = answer
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}\s+|[*+-]\s+|\d+[.)]\s+|>\s?)/gm, "")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";

  let spoken = "";
  for (const sentence of plain.split(/(?<=[.!?])\s+/)) {
    if (spoken && `${spoken} ${sentence}`.length > limit) break;
    spoken = spoken ? `${spoken} ${sentence}` : sentence;
  }
  // A first sentence that is too long on its own is cut at a word.
  if (spoken.length > limit) {
    const cut = spoken.slice(0, limit);
    spoken = `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : limit).replace(/[\s,;:]+$/, "")}.`;
  }
  return spoken.length < plain.length ? `${spoken} The rest is on screen.` : spoken;
}
