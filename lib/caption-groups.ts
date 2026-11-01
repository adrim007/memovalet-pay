/**
 * Who said it, said once.
 *
 * A panel that repeats "Adrian Kulatunga · English" above every line reads as
 * a list of interruptions rather than someone talking, and the name crowds out
 * the words — which are the point. So a run of lines from the same speaker
 * carries the name on the first line only, the way any messaging app does it.
 */
export function speakerRuns<T extends { speakerId: string }>(captions: T[]): boolean[] {
  return captions.map((caption, index) => index === 0 || captions[index - 1].speakerId !== caption.speakerId);
}
