import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWebSuggestions, MAX_QUERY_LENGTH, suggestionCountry, suggestionLanguage } from "@/lib/webSuggest";

// Suggestions for the home search bar's Web mode, in the visitor's country and
// language. Signed-in only, so nobody else can spend the suggestion allowance.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    // Tells the bar to stop asking until a key is added.
    if (!apiKey) return NextResponse.json({ suggestions: [], enabled: false });
    if (q.length < 2 || q.length > MAX_QUERY_LENGTH) return NextResponse.json({ suggestions: [], enabled: true });

    const suggestions = await fetchWebSuggestions(q, {
      apiKey,
      country: suggestionCountry(request.headers.get("x-vercel-ip-country")),
      lang: suggestionLanguage(request.headers.get("accept-language")),
    });
    return NextResponse.json(
      { suggestions, enabled: true },
      // Kept by this browser only; changing its language asks again.
      { headers: { "Cache-Control": "private, max-age=300", Vary: "Accept-Language" } }
    );
  } catch {
    return NextResponse.json({ suggestions: [], enabled: true });
  }
}
