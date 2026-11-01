/** Accept exactly the PCM format produced by our speech segmenter. Never trust a caller's duration. */
export function wavSeconds(audio: Uint8Array): number {
  if (audio.length < 44) throw new Error("Invalid WAV audio");
  const v = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
  const text = (start: number, n: number) => String.fromCharCode(...audio.slice(start, start+n));
  const rate = v.getUint32(24, true), bytes = v.getUint32(40, true);
  if (text(0,4) !== "RIFF" || text(8,4) !== "WAVE" || text(12,4) !== "fmt " || text(36,4) !== "data" ||
    v.getUint32(4,true) !== audio.length-8 || v.getUint32(16,true) !== 16 || v.getUint16(20,true) !== 1 ||
    v.getUint16(22,true) !== 1 || v.getUint16(34,true) !== 16 || v.getUint16(32,true) !== 2 ||
    rate !== 16000 || v.getUint32(28,true) !== rate*2 || bytes !== audio.length-44 || bytes%2 !== 0 || bytes === 0) throw new Error("Invalid WAV audio");
  const seconds = bytes/(rate*2);
  if (seconds > 21) throw new Error("Audio clip is too long");
  return seconds;
}
