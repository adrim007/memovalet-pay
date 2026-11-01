// Spoken replies in the browser, like Alexa's: a natural voice from the server when it arrives within
// VOICE_WAIT_MS, otherwise the browser's own voice. Used by the dashboard search bar and the Ask page.
// People can turn spoken replies off; the choice is kept in this browser.
const VOICE_WAIT_MS = 8000;
const PREF_KEY = "memovalet:spoken-replies";
const PREF_EVENT = "memovalet:spoken-replies-changed";

let playing: HTMLAudioElement | null = null;
let pending: AbortController | null = null;

export function spokenRepliesOn() {
  try { return localStorage.getItem(PREF_KEY) !== "off"; } catch { return true; }
}

export function setSpokenReplies(on: boolean) {
  try { localStorage.setItem(PREF_KEY, on ? "on" : "off"); } catch { /* private mode: the choice lasts this visit */ }
  if (!on) hushReply();
  window.dispatchEvent(new Event(PREF_EVENT));
}

// For useSyncExternalStore, so the speaker button follows the choice made in any tab.
export function subscribeSpokenReplies(callback: () => void) {
  window.addEventListener(PREF_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(PREF_EVENT, callback); window.removeEventListener("storage", callback); };
}

function browserVoice(text: string) {
  if (!("speechSynthesis" in window)) return;
  const lang = navigator.language || "en-AU";
  const voices = window.speechSynthesis.getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.voice = voices.find(voice => voice.lang === lang) ?? voices.find(voice => voice.lang.startsWith(lang.slice(0, 2))) ?? null;
  window.speechSynthesis.speak(utterance);
}

export async function speakReply(text: string, endpoint = "/api/speak") {
  if (!text.trim() || !spokenRepliesOn()) return;
  hushReply();
  const controller = new AbortController();
  pending = controller;
  const timer = setTimeout(() => controller.abort(), VOICE_WAIT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 400) }), signal: controller.signal,
    });
    if (!response.ok) throw new Error("Voice unavailable");
    const url = URL.createObjectURL(await response.blob());
    if (pending !== controller) { URL.revokeObjectURL(url); return; } // a newer reply or the microphone took over
    playing = new Audio(url);
    playing.onended = () => URL.revokeObjectURL(url);
    await playing.play();
  } catch {
    if (pending === controller) browserVoice(text);
  } finally {
    clearTimeout(timer);
    if (pending === controller) pending = null;
  }
}

export function hushReply() {
  const waiting = pending;
  pending = null;
  waiting?.abort();
  playing?.pause();
  playing = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
