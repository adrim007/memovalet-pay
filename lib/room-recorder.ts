import { Room, Track } from "livekit-client";
import { containerOf, pickRecordingMimeType } from "./recording-format";
import { manageRecorder } from "./recorder-lifecycle";
import { withCallTimeout } from "./call-timeout";
import { AUDIO_BITS_PER_SECOND, MAX_CLIP_BYTES, VIDEO_BITS_PER_SECOND } from "./recording-limits";
import { withPlayableDuration } from "./webm-duration";

/** Browser-side composite of subscribed room tracks, not just the local webcam.
 * The recording tab must remain open. Remote network gaps cannot be reconstructed.
 */
export async function startRoomRecording(room: Room, onLimit: () => void, maxBytes = MAX_CLIP_BYTES) {
  const mimeType = pickRecordingMimeType();
  if (!mimeType)
    throw new Error("This browser cannot record this call. Try desktop Chrome or Edge.");
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Recording canvas unavailable");
  if (typeof canvas.captureStream !== "function") throw new Error("This browser cannot record meeting video. You can still join and leave the call.");
  const audio = new AudioContext();
  try { await withCallTimeout(audio.resume(), 5000, "Recording could not start audio. Try again with this tab visible."); }
  catch (error) { void audio.close().catch(() => {}); throw error; }
  let canvasStream: MediaStream | undefined;
  let destination: MediaStreamAudioDestinationNode;
  let stream: MediaStream;
  try {
    destination = audio.createMediaStreamDestination();
    canvasStream = canvas.captureStream(20);
    stream = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
  } catch (error) {
    canvasStream?.getTracks().forEach(track => track.stop());
    void audio.close().catch(() => {});
    throw error;
  }
  const mixed = new Map<string, MediaStreamAudioSourceNode>();
  const videos = new Map<string, HTMLVideoElement>();
  let disposed = false;
  const render = () => {
    const tiles: { id: string; name: string; track?: MediaStreamTrack }[] = [];
    const audioIds = new Set<string>();
    const videoIds = new Set<string>();
    for (const person of [room.localParticipant, ...room.remoteParticipants.values()]) {
      let hasCamera = false;
      for (const publication of person.videoTrackPublications.values()) {
        const track = publication.track?.mediaStreamTrack;
        if (!track || publication.isMuted || track.readyState !== "live") continue;
        const screen = publication.source === Track.Source.ScreenShare;
        if (!screen) hasCamera = true;
        tiles.push({
          id: track.id,
          name: `${person.name || "Participant"}${screen ? " · Screen" : ""}`,
          track,
        });
        videoIds.add(track.id);
        if (!videos.has(track.id)) {
          const video = document.createElement("video");
          video.muted = true;
          video.playsInline = true;
          video.srcObject = new MediaStream([track]);
          void video.play().catch(() => {}); // Render a named tile until playback is available.
          videos.set(track.id, video);
        }
      }
      if (!hasCamera) tiles.push({ id: person.identity, name: person.name || "Participant" });
      for (const publication of person.audioTrackPublications.values()) {
        const track = publication.track?.mediaStreamTrack;
        if (!track || publication.isMuted || !track.enabled || track.readyState !== "live")
          continue;
        audioIds.add(track.id);
        if (!mixed.has(track.id)) {
          const source = audio.createMediaStreamSource(new MediaStream([track]));
          source.connect(destination); // Never play our own microphone into speakers.
          mixed.set(track.id, source);
        }
      }
    }
    for (const [id, source] of mixed)
      if (!audioIds.has(id)) {
        source.disconnect();
        mixed.delete(id);
      }
    for (const [id, video] of videos)
      if (!videoIds.has(id)) {
        video.pause();
        video.srcObject = null;
        videos.delete(id);
      }
    ctx.fillStyle = "#171326";
    ctx.fillRect(0, 0, 1280, 720);
    const columns = Math.ceil(Math.sqrt((Math.max(tiles.length, 1) * 16) / 9));
    const rows = Math.ceil(Math.max(tiles.length, 1) / columns);
    const width = 1280 / columns,
      height = 680 / rows;
    tiles.forEach((tile, index) => {
      const x = (index % columns) * width,
        y = Math.floor(index / columns) * height;
      ctx.fillStyle = "#302743";
      ctx.fillRect(x + 4, y + 4, width - 8, height - 8);
      const video = tile.track ? videos.get(tile.track.id) : null;
      if (video && video.readyState >= 2 && video.videoWidth) {
        const scale = Math.min((width - 8) / video.videoWidth, (height - 36) / video.videoHeight);
        const w = video.videoWidth * scale,
          h = video.videoHeight * scale;
        ctx.drawImage(video, x + (width - w) / 2, y + (height - 32 - h) / 2, w, h);
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px sans-serif";
      ctx.fillText(tile.name, x + 12, y + height - 13, width - 24);
    });
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px sans-serif";
    ctx.fillText("MemoValet · Call recording", 16, 707);
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    mixed.forEach((source) => source.disconnect());
    videos.forEach((video) => { video.pause(); video.srcObject = null; });
    stream.getTracks().forEach((track) => track.stop());
    void audio.close().catch(() => {});
  };
  try {
    const recorder = new MediaRecorder(stream, {
    mimeType,
    // See recording-limits: sized so parts fit the storage plan's file cap.
    videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
  });
  const lifecycle = manageRecorder(recorder, cleanup, onLimit, containerOf(mimeType), 8000, maxBytes);
  render();
  let warned = false;
  timer = setInterval(() => {
    try {
      render();
    } catch {
      if (!warned) { console.warn("[call-recording] frame_skipped"); warned = true; }
    }
  }, 50);
    const startedAt = Date.now();
    recorder.start(1000);
    // Once finished, the file is given its length so it plays with a seek bar
    // (see webm-duration). Stopping hands back the same finished file.
    const finished = lifecycle.finished.then(async (result) => ({
      ...result,
      blob: await withPlayableDuration(result.blob, Date.now() - startedAt),
    }));
    void finished.catch(() => {});
    return {
      finished,
      stop: () => { void lifecycle.stop(); return finished; },
      dispose: lifecycle.dispose,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
