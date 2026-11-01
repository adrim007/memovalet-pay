import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getLiveSessionPublic } from "@/lib/database";

// Live sessions are join-by-link, same as the rest of this feature — no
// account required, just a display name (see LiveSessionClient's guest
// join flow). The room name is the session id itself, so everyone who
// requests a token for the same session lands in the same LiveKit room.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getLiveSessionPublic(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json({ error: "This meeting has ended." }, { status: 410 });
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const identity = typeof body.identity === "string" ? body.identity.trim() : "";
    if (!name || !identity) {
      return NextResponse.json({ error: "name and identity are required" }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "LiveKit isn't configured yet" }, { status: 500 });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity, name, ttl: "4h" });
    at.addGrant({
      room: id,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    return NextResponse.json({ token });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error creating a LiveKit token" }, { status: 500 });
  }
}
