import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addressLanguage } from "@/lib/addressSuggest";
import { weatherLocation } from "@/lib/weather";

// What a location box needs to ask Geoapify from the browser (see
// lib/addressSuggest.ts): the key, handed only to signed-in users, and roughly
// where they are, so suggestions stay in their country and come nearest first.
// The location comes from this request and is never stored.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const key = process.env.GEOAPIFY_API_KEY;
    if (!key) return NextResponse.json({ enabled: false });

    const place = weatherLocation((name) => request.headers.get(name));
    return NextResponse.json(
      {
        enabled: true,
        key,
        near: place ? { latitude: place.latitude, longitude: place.longitude } : null,
        country: place?.country ?? request.headers.get("x-vercel-ip-country"),
        lang: addressLanguage(request.headers.get("accept-language")),
      },
      // This browser only, never a shared cache.
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Address suggestions are unavailable right now." }, { status: 503 });
  }
}
