export function parseParticipants(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}
