import { headers } from "next/headers";

// Vercel sets this automatically on every request, no configuration needed.
// It's absent in local dev, where we default to US spelling.
export async function isUKSpelling(): Promise<boolean> {
  const h = await headers();
  const country = h.get("x-vercel-ip-country");
  if (!country) return false;
  return country !== "US";
}

export function pickSpelling(useUK: boolean, us: string, uk: string): string {
  return useUK ? uk : us;
}
