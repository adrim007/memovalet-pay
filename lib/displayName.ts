interface UserLike {
  email?: string | null;
  user_metadata?: {
    first_name?: string;
    last_name?: string;
    given_name?: string;
    family_name?: string;
    full_name?: string;
    name?: string;
    account_type?: string;
  } | null;
}

function emailGuess(email?: string | null): string {
  return (email || "").split("@")[0].replace(/\./g, " ");
}

export function fullDisplayName(user: UserLike): string {
  const firstName = user.user_metadata?.first_name?.trim();
  const lastName = user.user_metadata?.last_name?.trim();
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return emailGuess(user.email);
}

export function firstDisplayName(user: UserLike): string {
  const firstName = user.user_metadata?.first_name?.trim();
  return firstName || emailGuess(user.email);
}

export function hasCompleteProfile(user: UserLike): boolean {
  const meta = user.user_metadata;
  return !!(
    meta?.first_name?.trim() &&
    meta?.last_name?.trim() &&
    (meta?.account_type === "personal" || meta?.account_type === "business")
  );
}

export function accountTypeOf(user: UserLike): "personal" | "business" {
  return user.user_metadata?.account_type === "business" ? "business" : "personal";
}

export function suggestedProfileNames(user: UserLike): {
  firstName: string;
  lastName: string;
} {
  const metadata = user.user_metadata;
  const firstName = metadata?.first_name?.trim() || metadata?.given_name?.trim() || "";
  const lastName = metadata?.last_name?.trim() || metadata?.family_name?.trim() || "";

  if (firstName && lastName) return { firstName, lastName };

  const providerName = metadata?.full_name?.trim() || metadata?.name?.trim() || "";
  const parts = providerName.split(/\s+/).filter(Boolean);

  return {
    firstName: firstName || parts[0] || "",
    lastName: lastName || (parts.length > 1 ? parts.slice(1).join(" ") : ""),
  };
}
