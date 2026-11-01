import { parsePlaces, reversePlaceUrl } from "./place-search";
import { weatherPlace, type WeatherPlace } from "./weather";

interface LookupConfig {
  key: string;
  near: { latitude: number; longitude: number } | null;
  lang: string | null;
}

export async function loadWeatherConfig(): Promise<LookupConfig | null> {
  try {
    const response = await fetch("/api/address/config", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    return response.ok && typeof data.key === "string" ? data : null;
  } catch { return null; }
}

// Passive refreshes never open a permission prompt. The location button does.
export async function currentWeatherPlace(requestPermission = false): Promise<WeatherPlace | null> {
  if (!navigator.geolocation) return null;
  if (!requestPermission) {
    try {
      if ((await navigator.permissions.query({ name: "geolocation" })).state !== "granted") return null;
    } catch { return null; }
  }
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false, timeout: 10000, maximumAge: 0,
    });
  });
  // Never send or save precise device coordinates. Recheck each visit/refresh.
  const latitude = Math.round(position.coords.latitude * 100) / 100;
  const longitude = Math.round(position.coords.longitude * 100) / 100;
  let place: WeatherPlace | null = null;
  try {
    const config = await loadWeatherConfig();
    if (config) {
      const response = await fetch(reversePlaceUrl(latitude, longitude, { apiKey: config.key, lang: config.lang }), {
        signal: AbortSignal.timeout(5000), cache: "no-store",
      });
      const [result] = response.ok ? parsePlaces(await response.json()) : [];
      if (result) {
        place = weatherPlace({
          name: result.name,
          latitude,
          longitude,
          country: result.country,
          timeZone: result.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        });
      }
    }
  } catch { /* Do not show a temperature unless its city can also be named. */ }
  return place;
}
