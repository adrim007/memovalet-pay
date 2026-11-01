/**
 * How big a call recording can get, and in how many parts.
 *
 * These were scattered across four files and none of them matched what the
 * storage could actually take. Supabase's Free plan rejects any single file over
 * 50 MB, whatever the bucket says, and the recorder was producing about 10 MB a
 * minute — so any recorded call past five minutes would have failed to upload,
 * and a failed upload stopped the whole meeting from saving. Nobody hit it only
 * because nobody had recorded yet.
 *
 * So a long recording is kept in parts, each comfortably under the cap, and each
 * part is uploaded as soon as it is finished rather than all at once at the end.
 */

/** Well clear of the Free plan's 50 MB per-file limit. */
export const MAX_CLIP_BYTES = 45 * 1024 * 1024;

/** Enough parts for a meeting of about two and a half hours at the rates below. */
export const MAX_RECORDING_CLIPS = 16;

/**
 * About 5 MB a minute, so a part runs roughly nine minutes. Talking faces on a
 * composited grid compress well, and the Free plan's 1 GB of storage holds
 * about three hours of recordings in total at this rate rather than ninety
 * minutes at the old one.
 */
export const VIDEO_BITS_PER_SECOND = 600_000;
export const AUDIO_BITS_PER_SECOND = 64_000;

/** Roughly how many minutes of call one part holds. */
export function minutesPerClip(): number {
  const bytesPerSecond = (VIDEO_BITS_PER_SECOND + AUDIO_BITS_PER_SECOND) / 8;
  return MAX_CLIP_BYTES / bytesPerSecond / 60;
}

export interface RecordingClip {
  blob: Blob;
  /**
   * Which part this is, numbered when capture began, so parts stay in order
   * however they finish or upload. A counter rather than a time: nothing to
   * skew, and two parts can never tie.
   */
  order: number;
  /** Set once the part is safely in storage. */
  url?: string;
}

/**
 * The storage addresses to save with the meeting: only the parts that actually
 * uploaded, in the order they were recorded. A part that failed is left out
 * rather than sent as a blank — the server rejects a meeting whose recording
 * list has a hole in it, and one lost part must never cost the whole meeting.
 */
export function uploadedClipUrls(clips: RecordingClip[]): string[] {
  return [...clips]
    .sort((a, b) => a.order - b.order)
    .map((clip) => clip.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
}
