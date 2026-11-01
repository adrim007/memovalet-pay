import type { LocalParticipant } from "livekit-client";

export async function setCallDevice(
  participant: Pick<LocalParticipant, "setCameraEnabled" | "setMicrophoneEnabled">,
  stream: MediaStream | null,
  kind: "audio" | "video",
  enabled: boolean,
): Promise<MediaStream> {
  const publication = kind === "video"
    ? await participant.setCameraEnabled(enabled)
    : await participant.setMicrophoneEnabled(enabled);
  const localTrack = publication?.track;
  // An interruption may end a track while the SDK still considers it unmuted.
  if (enabled && localTrack?.mediaStreamTrack.readyState === "ended") {
    await localTrack.restartTrack();
    await localTrack.unmute();
  }
  const track = localTrack?.mediaStreamTrack;
  if (enabled && (!track || track.readyState === "ended")) {
    throw new Error("The device did not provide a live track.");
  }
  // LiveKit may replace a track when a device resumes. Never keep the old one.
  return new MediaStream([
    ...(stream?.getTracks().filter(item => item.kind !== kind) ?? []),
    ...(track ? [track] : []),
  ]);
}

export function callDeviceError(error: unknown, device: string): string {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return `Allow ${device} access in your browser's website settings, then try again.`;
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return `No ${device} was found. Reconnect your device and try again.`;
  if (name === "NotReadableError" || name === "TrackStartError")
    return `Your ${device} is unavailable. Close other apps using it, then try again.`;
  return `Couldn't start your ${device}. Check browser permissions and try again.`;
}
