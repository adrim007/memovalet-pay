/**
 * Whether one typed word points at something labelled with `labels`.
 *
 * Shared by the emoji and GIF pickers so they forgive the same things. Endings
 * are ignored in both directions — someone typing "thanks" means the one
 * labelled "thank", and someone typing "cele" is still looking for "celebrate".
 */
export function wordMatches(labels: string, word: string): boolean {
  return labels
    .split(/\s+/)
    .some((label) => label.startsWith(word) || (word.length >= 3 && word.startsWith(label) && label.length >= 3));
}

/** Splits what someone typed into the words to match, or none for "show all". */
export function searchWords(query: string): string[] {
  const needle = query.trim().toLowerCase();
  return needle ? needle.split(/\s+/) : [];
}
