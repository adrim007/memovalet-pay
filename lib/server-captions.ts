import { createSpeechSegmenter, encodeWav, type SpeechSegment } from "./speech-segments";

/**
 * Listens to the call's own microphone track and hands each piece of speech to
 * `transcribe`, in order. Works in every browser that can join the call, which
 * the browser's built-in speech recognition does not (see speech-segments).
 *
 * In "watch" mode nothing is captioned: it reports how much speech it heard, so
 * the call page can notice built-in recognition hearing nothing while someone
 * is plainly talking, and it can hand over the first piece or two of speech
 * (`onSample`) so the language being spoken can be worked out — the browser's
 * own recognition has to be told a language and cannot tell you.
 */
export interface MicrophoneListener {
  /** Stops listening. Speech still being transcribed is finished, not dropped. */
  stop: () => void;
  /** Ends the current piece now and waits (up to `timeoutMs`) for every piece to be written. */
  finish: (timeoutMs: number) => Promise<void>;
}

type AudioContextConstructor = typeof AudioContext;

export function canListenToMicrophone(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor };
  const Context = w.AudioContext || w.webkitAudioContext;
  return Boolean(Context && "createScriptProcessor" in Context.prototype);
}

export function listenToMicrophone(options: {
  track: MediaStreamTrack;
  mode: "transcribe" | "watch";
  /** Sends one piece and resolves once its words are handled. */
  transcribe?: (wav: Blob, startedAt: number) => Promise<void>;
  onVoice?: (voicedMs: number) => void;
  /** The first few pieces of speech, for working out the language. */
  onSample?: (wav: Blob, voicedMs: number) => void;
  /** How many pieces to hand to `onSample` (default one). */
  samples?: number;
  /**
   * No sound at all has arrived since listening began. Browsers hold audio
   * processing until the page has been clicked, and a page opened straight
   * into a call may not have been — captions would then sit silent for the
   * whole meeting with nothing to show for it.
   */
  onSilentStart?: (afterMs: number) => void;
}): MicrophoneListener {
  const w = window as unknown as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor };
  const Context = (w.AudioContext || w.webkitAudioContext)!;
  const context = new Context();
  // A page opened straight into a call may not have been clicked yet, and
  // browsers hold sound processing until it is. Carry on at the first click
  // or key press rather than staying silent for the whole meeting.
  const wake = () => { if (context.state === "suspended") void context.resume().catch(() => {}); };
  wake();
  document.addEventListener("pointerdown", wake);
  document.addEventListener("keydown", wake);

  const source = context.createMediaStreamSource(new MediaStream([options.track]));
  // ScriptProcessor is old, but it is the one way to read raw sound that every
  // browser still has, without shipping a separate worklet file.
  const processor = context.createScriptProcessor(4096, 1, 1);
  // It only runs when connected through to the speakers; through silence, so
  // nobody hears their own voice.
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(processor);
  processor.connect(mute);
  mute.connect(context.destination);

  let pending: Promise<void> = Promise.resolve();
  let samplesLeft = options.samples ?? 1;
  const asWav = (segment: SpeechSegment) =>
    new Blob([encodeWav(segment.samples, segment.sampleRate).buffer as ArrayBuffer], { type: "audio/wav" });

  const send = (segment: SpeechSegment) => {
    if (options.onSample && samplesLeft > 0) {
      samplesLeft -= 1;
      options.onSample(asWav(segment), segment.voicedMs);
    }
    if (options.mode !== "transcribe" || !options.transcribe) return;
    const wav = asWav(segment);
    // One at a time, so the words arrive in the order they were said.
    const transcribe = options.transcribe;
    pending = pending.then(() => transcribe(wav, segment.startedAt)).catch(() => {});
  };

  const segmenter = createSpeechSegmenter({
    sampleRate: context.sampleRate,
    onSegment: send,
    onFrame: (voiced, frameMs) => { if (voiced) options.onVoice?.(frameMs); },
  });

  let stopped = false;
  let heardAnything = false;
  const STALL_MS = 4000;
  const watchdog = setTimeout(() => {
    if (!heardAnything && !stopped) options.onSilentStart?.(STALL_MS);
  }, STALL_MS);
  processor.onaudioprocess = (event) => {
    if (stopped) return;
    heardAnything = true;
    clearTimeout(watchdog);
    // The browser reuses this buffer, so keep a copy.
    segmenter.push(new Float32Array(event.inputBuffer.getChannelData(0)), Date.now());
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(watchdog);
    segmenter.flush();
    processor.onaudioprocess = null;
    document.removeEventListener("pointerdown", wake);
    document.removeEventListener("keydown", wake);
    try { source.disconnect(); processor.disconnect(); mute.disconnect(); } catch { /* already gone */ }
    void context.close().catch(() => {});
  };

  return {
    stop,
    finish: async (timeoutMs) => {
      stop();
      await Promise.race([pending, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
    },
  };
}
