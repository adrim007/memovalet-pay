// Natural speech from Gemini's speech model, shared by the Alexa+ assistant's and the dashboard's
// spoken replies. Both pages fall back to the browser's own voice whenever this returns nothing.
const MODEL = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-lite-tts";
const VOICE = "Aoede";

// Some voice models send a finished WAV file and others raw 16 bit PCM; browsers need the file.
function asWav(bytes: Buffer, mimeType = "") {
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF") return bytes;
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + bytes.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(bytes.length, 40);
  return Buffer.concat([header, bytes]);
}

/** A WAV recording of the text, or null when there is no key or the voice service fails. */
export async function synthesizeSpeech(text: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    // Only the words go in: this voice model reads any style instructions out loud.
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
    }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  const data = await response?.json().catch(() => null) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  } | null;
  const audio = data?.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
  if (!response?.ok || !audio?.data) return null;
  return new Uint8Array(asWav(Buffer.from(audio.data, "base64"), audio.mimeType));
}
