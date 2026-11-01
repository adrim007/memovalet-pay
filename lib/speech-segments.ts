/**
 * Cuts a microphone's sound into short pieces of speech, and packs a piece as
 * a WAV file, for MemoValet's own transcription.
 *
 * Captions used to depend entirely on the browser's built-in speech
 * recognition. Firefox has none; Brave, Arc and Opera have it but it fails;
 * Safari's is unreliable; and even in Chrome it listens to the computer's
 * default microphone rather than the one the call is using. In any of those
 * the call went ahead with nothing written down, and the saved transcript held
 * only what people had typed. Transcribing the call's own microphone on our
 * side works the same in every browser.
 *
 * Pieces end where the speaker pauses, so words are not cut in half, and
 * silence is never sent anywhere. No DOM here, so it can be tested directly.
 */

export interface SpeechSegment {
  samples: Float32Array;
  sampleRate: number;
  /** When the speech began, in the clock passed to `push`. */
  startedAt: number;
  /** How much of the piece was voice rather than pause, in ms. */
  voicedMs: number;
}

export interface SegmenterOptions {
  sampleRate: number;
  onSegment: (segment: SpeechSegment) => void;
  /** Every frame, voice or not — for noticing speech without sending it. */
  onFrame?: (voiced: boolean, frameMs: number) => void;
  /** A pause this long ends a piece. */
  endSilenceMs?: number;
  /** Past this, a shorter pause will do, so a long talker still gets captions. */
  softMaxMs?: number;
  softEndSilenceMs?: number;
  /** Never longer than this, pause or not. */
  hardMaxMs?: number;
  /** Kept from before speech starts, so the first word isn't clipped. */
  preRollMs?: number;
  /** A cough or a door is not worth transcribing. */
  minVoicedMs?: number;
  /** How far back the room's background level is judged from. */
  noiseWindowMs?: number;
}

/** Quieter than this is never counted as speech, however quiet the room. */
const MIN_SPEECH_LEVEL = 0.01;

export function frameLevel(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return frame.length ? Math.sqrt(sum / frame.length) : 0;
}

export function createSpeechSegmenter(options: SegmenterOptions) {
  const {
    sampleRate,
    onSegment,
    onFrame,
    endSilenceMs = 700,
    softMaxMs = 9000,
    softEndSilenceMs = 250,
    hardMaxMs = 20000,
    preRollMs = 300,
    minVoicedMs = 400,
    noiseWindowMs = 3000,
  } = options;

  // The room's background level: the quietest moment of the last few seconds.
  // Speech always dips between words, right down to the background, so this
  // finds the room even while someone talks — and a fan or traffic, which
  // never dips, becomes the background within a few seconds instead of
  // reading as someone talking. Until the window has filled, assume a quiet room.
  const levels: number[] = [];
  let levelsFilled = false;
  let preRoll: Float32Array[] = [];
  let preRollLength = 0;
  let current: Float32Array[] = [];
  let currentMs = 0;
  let voicedMs = 0;
  let silenceMs = 0;
  let startedAt = 0;
  let speaking = false;

  const finish = () => {
    if (speaking && voicedMs >= minVoicedMs) {
      const length = current.reduce((total, frame) => total + frame.length, 0);
      const samples = new Float32Array(length);
      let offset = 0;
      for (const frame of current) {
        samples.set(frame, offset);
        offset += frame.length;
      }
      onSegment({ samples, sampleRate, startedAt, voicedMs });
    }
    speaking = false;
    current = [];
    currentMs = 0;
    voicedMs = 0;
    silenceMs = 0;
  };

  const push = (frame: Float32Array, now: number) => {
    const frameMs = (frame.length / sampleRate) * 1000;
    const level = frameLevel(frame);
    const windowFrames = Math.max(1, Math.round(noiseWindowMs / frameMs));
    levels.push(level);
    if (levels.length >= windowFrames) levelsFilled = true;
    while (levels.length > windowFrames) levels.shift();
    const noiseFloor = levelsFilled ? Math.min(...levels) : MIN_SPEECH_LEVEL / 3;
    const voiced = level > Math.max(MIN_SPEECH_LEVEL, noiseFloor * 3);
    onFrame?.(voiced, frameMs);

    if (!speaking) {
      if (voiced) {
        speaking = true;
        const preRollMsHeld = (preRollLength / sampleRate) * 1000;
        current = [...preRoll, frame];
        currentMs = preRollMsHeld + frameMs;
        startedAt = now - currentMs;
        voicedMs = frameMs;
        silenceMs = 0;
        preRoll = [];
        preRollLength = 0;
      } else {
        preRoll.push(frame);
        preRollLength += frame.length;
        while (preRoll.length > 1 && ((preRollLength - preRoll[0].length) / sampleRate) * 1000 >= preRollMs) {
          preRollLength -= preRoll.shift()!.length;
        }
      }
      return;
    }

    current.push(frame);
    currentMs += frameMs;
    if (voiced) {
      voicedMs += frameMs;
      silenceMs = 0;
    } else {
      silenceMs += frameMs;
    }
    const pauseNeeded = currentMs >= softMaxMs ? softEndSilenceMs : endSilenceMs;
    if (silenceMs >= pauseNeeded || currentMs >= hardMaxMs) finish();
  };

  return {
    push,
    /** Ends the piece in progress, if it holds any speech. */
    flush: finish,
  };
}

/**
 * A piece of sound as a 16 kHz, 16-bit mono WAV — what speech services take
 * everywhere, and about 32 KB a second, whatever the browser recorded at.
 */
export function encodeWav(samples: Float32Array, inputRate: number, outputRate = 16000): Uint8Array {
  const rate = Math.min(outputRate, inputRate);
  const ratio = inputRate / rate;
  const length = Math.floor(samples.length / ratio);
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    // Average the input samples that fold into this one: a cheap low-pass
    // that keeps higher sample rates from aliasing into hiss.
    const from = Math.floor(i * ratio);
    const to = Math.max(from + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to && j < samples.length; j++) sum += samples[j];
    const value = Math.max(-1, Math.min(1, sum / (to - from)));
    pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }

  const bytes = new Uint8Array(44 + pcm.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // format chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample frame
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
  return bytes;
}
