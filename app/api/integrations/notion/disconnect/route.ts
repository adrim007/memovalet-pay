import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { error } = await createServiceClient().from("notion_connections").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not disconnect" }, { status: 503 });
  return NextResponse.redirect(new URL("/settings#integrations", req.url), 303);
}
