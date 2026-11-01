import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchForecast, savedWeatherLocation, summariseForecast, temperatureUnit, weatherLocation, weatherPlace, type WeatherLocation } from "@/lib/weather";

const headers = { "Cache-Control": "private, no-store" };
async function forecastResponse(location: WeatherLocation | null, source: string) {
  const forecast = location ? await fetchForecast(location) : null;
  const weather = forecast && location ? summariseForecast(forecast, {
    city: location.city, unit: temperatureUnit(location.country), timeZone: location.timeZone,
  }) : null;
  return NextResponse.json({ weather, source }, { headers });
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
    // Older versions saved both GPS fixes and manual choices identically. Those
    // ambiguous snapshots must not pin travelling users to an old city.
    const chosen = user.user_metadata?.weather_location_mode === "chosen"
      ? savedWeatherLocation(user.user_metadata) : null;
    return await forecastResponse(chosen ?? weatherLocation((name) => request.headers.get(name)), chosen ? "chosen" : "connection");
  } catch {
    return NextResponse.json({ weather: null, source: "connection" }, { headers });
  }
}

// Device location is used for this request only; it is never written to the account.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
    const place = weatherPlace(await request.json());
    if (!place) return NextResponse.json({ error: "Invalid location" }, { status: 400, headers });
    return await forecastResponse({ ...place, city: place.name || null }, "device");
  } catch {
    return NextResponse.json({ weather: null, source: "device" }, { headers });
  }
}
