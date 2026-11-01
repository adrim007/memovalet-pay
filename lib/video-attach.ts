/**
 * Putting a live stream on screen and keeping it there.
 *
 * Two things make a call freeze or go black, and neither raises an error:
 *
 *  * a paused element. play() rejects if a second stream is attached while the
 *    first is still loading, and a rejected play leaves the element sitting on
 *    its last frame forever — a frozen picture with nothing in the console.
 *  * a stalled track. A remote track "mutes" when packets stop arriving and
 *    "unmutes" when they come back, and the element does not always pick up
 *    again by itself.
 *
 * So rather than play once and hope, this keeps watch and starts it again.
 */
export function attachStream(video: HTMLVideoElement, stream: MediaStream): () => void {
  let released = false;

  const play = () => {
    if (released) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    // Only nudge an element that has actually stopped, so this can never fight
    // with a deliberate pause.
    if (!video.paused) return;
    const started = video.play?.();
    if (started && typeof started.catch === "function") started.catch(() => {});
  };

  // The first attach has nothing to resume, so it always calls play().
  if (video.srcObject !== stream) video.srcObject = stream;
  const first = video.play?.();
  if (first && typeof first.catch === "function") first.catch(() => {});

  const onVisible = () => {
    if (!document.hidden) play();
  };

  video.addEventListener("pause", play);
  document.addEventListener("visibilitychange", onVisible);
  const tracks = stream.getVideoTracks();
  for (const track of tracks) track.addEventListener("unmute", play);

  return () => {
    released = true;
    video.removeEventListener("pause", play);
    document.removeEventListener("visibilitychange", onVisible);
    for (const track of tracks) track.removeEventListener("unmute", play);
    video.srcObject = null;
  };
}

/**
 * Adds a track to someone's stream, keeping exactly one live track per kind.
 *
 * A video element shows the first video track it is handed. When a camera is
 * swapped — a device change, a reconnect — the old track can still be sitting
 * in front of the new one, and what you get is a black rectangle from a track
 * that ended. Screens are carried separately, so one camera and one microphone
 * per person is the whole truth here.
 */
export function withTrack(existing: MediaStream | undefined, track: MediaStreamTrack): MediaStream {
  const keep = (existing?.getTracks() ?? []).filter(
    (other) => other.readyState === "live" && other.kind !== track.kind
  );
  const next = new MediaStream(keep);
  next.addTrack(track);
  return next;
}
