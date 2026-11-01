import { NextResponse } from "next/server";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { getLiveSessionForHost } from "@/lib/database";

// The host switching someone's microphone off for the whole room — the person
// who walked away with their mic live, the building site in the background.
//
// Muting only, deliberately. Turning someone's microphone back on from another
// computer would let a host listen in on a room they were asked to leave alone,
// so the host can ask and the person unmutes themselves. The same rule Zoom and
// Teams settled on.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    // Guests join by link and have no account, so only the signed-in host who
    // created this session can do this. Checked here rather than left to the
    // database, which would report success on a row it never touched.
    const owned = await getLiveSessionForHost(id, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Only the host can mute people" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const identity = typeof body?.identity === "string" ? body.identity.trim() : "";
    if (!identity) return NextResponse.json({ error: "Unknown person" }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret) {
      return NextResponse.json({ error: "LiveKit isn't configured yet" }, { status: 500 });
    }

    const service = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret, {
      requestTimeout: 8,
    });

    let microphone;
    try {
      const participant = await service.getParticipant(id, identity);
      microphone = participant.tracks?.find(
        (track) => track.source === TrackSource.MICROPHONE && !track.muted
      );
    } catch {
      return NextResponse.json({ error: "They've already left the meeting" }, { status: 404 });
    }

    // Nothing to do: they are muted already, or never turned a microphone on.
    if (!microphone) return NextResponse.json({ ok: true, alreadyMuted: true });

    await service.mutePublishedTrack(id, identity, microphone.sid, true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Muting a participant failed", error);
    return NextResponse.json({ error: "Couldn't mute them. Try again." }, { status: 500 });
  }
}
