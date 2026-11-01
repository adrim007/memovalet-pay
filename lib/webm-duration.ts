import fixWebmDuration from "fix-webm-duration";
import { containerOf } from "./recording-format";

/**
 * Writes a recording's length into the file itself.
 *
 * A browser writes a WebM recording as it goes, before it knows how long the
 * recording will be, so it leaves the length out. A player given such a file
 * shows no length and no usable seek bar — you can press play, but you cannot
 * skip ahead, and some players will not start it at all. Filling the length in
 * after recording is what makes it an ordinary video to watch.
 *
 * Never fails: a file it cannot fix is returned as it was, since a recording
 * without a seek bar is still far better than no recording.
 */
export async function withPlayableDuration(blob: Blob, durationMs: number): Promise<Blob> {
  const container = containerOf(blob.type);
  if (container !== "video/webm" && container !== "audio/webm") return blob;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return blob;
  try {
    return await fixWebmDuration(blob, durationMs, { logger: false });
  } catch {
    return blob;
  }
}

/** Starts timing a recording; the returned function says how long it has run, in ms. */
export function startRecordingClock(): () => number {
  const startedAt = Date.now();
  return () => Date.now() - startedAt;
}
