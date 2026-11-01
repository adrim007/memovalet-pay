import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "crypto";

type Provider = "notion" | "trello";

const cookieName = (provider: Provider) => `memovalet_${provider}_state`;
const cookiePath = (provider: Provider) => `/api/integrations/${provider}`;

/**
 * Proof that the person coming back from Notion or Trello is the one who set off
 * from here. Without it, someone could send a victim a link that finishes
 * connecting the *attacker's* account, and the victim's meeting notes would
 * quietly flow into it. Tied to the user as well as a random value, and
 * single-use.
 */
export async function issueConnectState(provider: Provider, userId: string, secure: boolean) {
  const state = randomBytes(32).toString("hex");
  (await cookies()).set(cookieName(provider), `${userId}:${state}`, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: cookiePath(provider),
    maxAge: 600,
  });
  return state;
}

export async function consumeConnectState(provider: Provider, userId: string, state: string | null) {
  const jar = await cookies();
  const expected = jar.get(cookieName(provider))?.value;
  jar.set(cookieName(provider), "", { path: cookiePath(provider), maxAge: 0 });
  if (!expected || !state) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(`${userId}:${state}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
