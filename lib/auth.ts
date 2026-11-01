import { cache } from "react";
import { createClient } from "./supabase/server";

// Deduped per request: multiple calls within the same render (layout + page)
// only hit Supabase once instead of once per caller.
export const getAuthedUser = cache(async () => {
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    return result.data.user;
  } catch (err) {
    console.error("Failed to check auth session", err);
    return null;
  }
});

const getAssuranceLevel = cache(async () => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data;
  } catch (err) {
    console.error("Failed to check MFA status", err);
    return null;
  }
});

// True once a user has a verified authenticator app factor but hasn't
// completed that second-factor challenge yet this session (still at aal1
// when the account requires aal2). Users with no 2FA enrolled never hit
// this, since their nextLevel never rises above aal1.
export const needsMfaChallenge = cache(async () => {
  const data = await getAssuranceLevel();
  return !!data && data.nextLevel === "aal2" && data.currentLevel !== data.nextLevel;
});

/** A verified authenticator app is attached to this account. */
export const hasAuthenticator = cache(async () => {
  const data = await getAssuranceLevel();
  return data?.nextLevel === "aal2";
});

type UserWithMetadata = { user_metadata?: Record<string, unknown> | null };

/**
 * Whether we've already asked this person about 2-step verification — they
 * either set it up or said "not now". Only controls whether the question is
 * shown, never whether anything is protected, so it's fine that it lives in
 * metadata the user can edit.
 */
export function hasAnsweredSecurityPrompt(user: UserWithMetadata): boolean {
  return user.user_metadata?.security_prompted === true;
}
