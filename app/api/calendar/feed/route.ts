import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { feedTokenFor, issueFeedToken, removeFeedToken } from "@/lib/calendar-feed-data";

// Your own calendar link: see it (GET), make it or a new one (POST, with
// { "reset": true } to replace it), or turn it off (DELETE).
const headers = { "Cache-Control": "private, no-store" };

function links(origin: string, token: string) {
  const url = `${origin}/api/calendar/feed/${token}.ics`;
  const webcal = url.replace(/^https?:\/\//, "webcal://");
  return {
    url,
    // Apple Calendar (iPhone, iPad, Mac) subscribes when it opens a webcal link.
    apple: webcal,
    // Google Calendar's "add by URL", with the link already filled in.
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  };
}

async function signedIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: Request) {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
  try {
    const token = await feedTokenFor(user.id);
    return NextResponse.json(token ? links(new URL(request.url).origin, token) : { url: null }, { headers });
  } catch (error) {
    console.error("Calendar link lookup failed", error);
    return NextResponse.json({ error: "Your calendar link couldn't be loaded. Please try again." }, { status: 500, headers });
  }
}

export async function POST(request: Request) {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
  const body = await request.json().catch(() => ({}));
  try {
    const existing = body?.reset ? null : await feedTokenFor(user.id);
    const token = existing ?? (await issueFeedToken(user.id));
    return NextResponse.json(links(new URL(request.url).origin, token), { headers });
  } catch (error) {
    console.error("Calendar link creation failed", error);
    return NextResponse.json({ error: "Your calendar link couldn't be made. Please try again." }, { status: 500, headers });
  }
}

export async function DELETE() {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
  try {
    await removeFeedToken(user.id);
    return NextResponse.json({ url: null }, { headers });
  } catch (error) {
    console.error("Calendar link removal failed", error);
    return NextResponse.json({ error: "Your calendar link couldn't be turned off. Please try again." }, { status: 500, headers });
  }
}
