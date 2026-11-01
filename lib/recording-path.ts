import { isAudioExtension } from "./recording-format";

export const PRIVATE_RECORDING_PREFIX = "private-recording:";

// Deliberately strict: the path is handed to a service-role signing call, so it
// must be exactly "<uuid>/<uuid>.<known extension>" and nothing that could walk
// out of the caller's own folder.
const RECORDING_PATH =
  /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(webm|mp4|mov|m4a|mp3|wav|weba)$/;

export function parseRecordingPath(value: string): string | null {
  if (!value.startsWith(PRIVATE_RECORDING_PREFIX)) return null;
  const path = value.slice(PRIVATE_RECORDING_PREFIX.length);
  return RECORDING_PATH.test(path) ? path : null;
}

/** Sound-only recordings need an audio player, not a black video rectangle. */
export function isAudioRecording(value: string): boolean {
  const path = parseRecordingPath(value);
  if (!path) return false;
  return isAudioExtension(path.slice(path.lastIndexOf(".") + 1));
}
