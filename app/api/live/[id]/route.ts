import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { endLiveSession, getLiveSessionForHost, getLiveSessionPublic } from "@/lib/database";
import { RoomServiceClient } from "livekit-server-sdk";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getLiveSessionPublic(id);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const canManage = user ? !!(await getLiveSessionForHost(id, user.id)) : false;
    return NextResponse.json({ session, canManage });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error fetching live session" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    // Only the host who created the session may end it. Without this guard the
    // update relies solely on RLS and would silently report success on a 0-row
    // update for a session owned by someone else.
    const owned = await getLiveSessionForHost(id, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await req.json();
    const meetingId = typeof body.meetingId === "string" ? body.meetingId : null;
    if (meetingId) {
      const saved = await supabase.from("meetings").select("id").eq("id", meetingId).eq("user_id", user.id).maybeSingle();
      if (saved.error || !saved.data) return NextResponse.json({ error: "Saved meeting not found" }, { status: 404 });
    }

    const ok = await endLiveSession(id, meetingId ?? owned.meeting_id);

    if (!ok) {
      return NextResponse.json({ error: "Couldn't end that session" }, { status: 500 });
    }

    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    if (url && key && secret) {
      try {
        const service = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret, { requestTimeout: 8 });
        await service.deleteRoom(id);
      } catch (error) {
        // Repeated end requests are safe even after the room was removed.
        if (!(error && typeof error === "object" && "code" in error && error.code === "not_found")) {
          console.warn("[call-end] transport_close_failed");
          return NextResponse.json({ error: "The session is marked ended, but disconnecting everyone failed. Retry ending the meeting." }, { status: 503 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error ending live session" }, { status: 500 });
  }
}
