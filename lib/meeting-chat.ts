export const CHAT_TOPIC = "memovalet.chat.v1";
export interface ChatDraft { text: string; gifUrl?: string }
export interface ChatMessage extends ChatDraft { id: string; senderId: string; senderName: string; sentAt: number }

export function safeGifUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return;
  try {
    const url = new URL(value);
    const allowed = ["media.giphy.com", "i.giphy.com", "media0.giphy.com", "media1.giphy.com", "media2.giphy.com", "media3.giphy.com", "media4.giphy.com", "media.tenor.com"];
    if (url.protocol !== "https:" || url.username || url.password || url.port || !allowed.includes(url.hostname) || !url.pathname.toLowerCase().endsWith(".gif")) return;
    return url.href;
  } catch { return; }
}

export function parseChatPacket(bytes: Uint8Array, senderId: string, senderName: string): ChatMessage | null {
  if (bytes.byteLength > 12000) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(value.id) || typeof value.text !== "string" || value.text.length > 2000) return null;
    const text = value.text.trim();
    const gifUrl = safeGifUrl(value.gifUrl);
    if ((value.gifUrl && !gifUrl) || (!text && !gifUrl)) return null;
    // Identity comes from the call transport, never from the message body.
    return { id: value.id, text, gifUrl, senderId, senderName: senderName.slice(0, 100), sentAt: Date.now() };
  } catch { return null; }
}

export function appendChat(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (messages.some(item => item.id === message.id && item.senderId === message.senderId)) return messages;
  return [...messages, message].slice(-200);
}
