import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const GOOGLE_PENDING_COOKIE = "memovalet_google_pending";
export const GOOGLE_COMPLETE_PATH = "/auth/google/complete";
export const GOOGLE_PENDING_SECONDS = 600;
type PendingConnection = { userId: string; refreshToken: string; next: string; expires: number };

export function googleNextPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/dashboard";
  return value;
}

function key() {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("Google connection configuration is missing.");
  return createHash("sha256").update("memovalet:pending-google:v1:").update(secret).digest();
}

// Carry the OAuth result across MFA without saving a usable connection before
// the user passes MFA. The token is encrypted, short lived and account bound.
export function sealGoogleConnection(userId: string, refreshToken: string, next: string, now = Date.now()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload: PendingConnection = { userId, refreshToken, next: googleNextPath(next), expires: now + GOOGLE_PENDING_SECONDS * 1000 };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const sealed = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  if (sealed.length > 3500) throw new Error("Google connection is too large to resume safely.");
  return sealed;
}

export function openGoogleConnection(value: string, userId: string, now = Date.now()): PendingConnection | null {
  try {
    if (!value || value.length > 3500 || !/^[\w-]+$/.test(value)) return null;
    const data = Buffer.from(value, "base64url");
    if (data.length <= 28) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const pending = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
    if (pending.userId !== userId || typeof pending.refreshToken !== "string" || !pending.refreshToken || !Number.isFinite(pending.expires) || pending.expires <= now || pending.expires > now + GOOGLE_PENDING_SECONDS * 1000 || typeof pending.next !== "string") return null;
    return { ...pending, next: googleNextPath(pending.next) };
  } catch { return null; }
}

export function googlePendingCookieOptions(origin: string) {
  return { httpOnly: true, secure: new URL(origin).protocol === "https:", sameSite: "lax" as const, path: GOOGLE_COMPLETE_PATH, maxAge: GOOGLE_PENDING_SECONDS };
}
