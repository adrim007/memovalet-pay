// One place decides what this browser can actually record, and what a stored
// recording is called.
//
// Safari has never supported WebM. Asking MediaRecorder for "video/webm" there
// throws NotSupportedError before a single frame is captured, so a hardcoded
// WebM recorder simply never starts — and the failure looks like a denied
// camera, which sends people off changing permissions that were never at fault.
// Offer each container in turn and use the first the browser admits to.

const VIDEO_CANDIDATES = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
const AUDIO_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export type CaptureKind = "video" | "audio";

export function pickRecordingMimeType(kind: CaptureKind = "video"): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = kind === "audio" ? AUDIO_CANDIDATES : VIDEO_CANDIDATES;
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || null;
}

/** The container without the codec suffix — how a Blob and an upload are labelled. */
export function containerOf(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

// Audio and video both come out of WebM, so they are given different extensions
// on the way in. The stored filename is the only thing the meeting page has to
// go on when deciding whether to draw a video player or an audio player.
const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov", // what an iPhone's own camera produces
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "weba",
  "audio/ogg": "weba",
};

const AUDIO_EXTENSIONS = new Set(["m4a", "mp3", "wav", "weba"]);

/** null when the file is not something we are willing to store or play back. */
export function extensionFor(mimeType: string): string | null {
  return EXTENSIONS[containerOf(mimeType)] ?? null;
}

export function isAudioExtension(extension: string): boolean {
  return AUDIO_EXTENSIONS.has(extension.toLowerCase());
}

/** What a file picker should offer: the phone's own camera and voice recorder
 *  produce these, and Apple lets those keep running with the screen off. */
export const UPLOADABLE_RECORDING_ACCEPT = "video/*,audio/*";

// The most a single stored recording can be. The bucket says 500 MB, but the
// storage plan refuses any one file over 50 MB whatever the bucket says, so
// anything larger was accepted here and then failed to upload.
export { MAX_CLIP_BYTES as MAX_RECORDING_BYTES } from "./recording-limits";
