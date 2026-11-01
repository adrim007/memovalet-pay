import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withClockSkewRetry } from "./skew-retry";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      global: { fetch: withClockSkewRetry(fetch) },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll was called from a Server Component; safe to ignore
            // because middleware refreshes the session on every request.
          }
        },
      },
    }
  );
}
