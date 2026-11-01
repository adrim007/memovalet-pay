import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { data: document, error } = await supabase.from("documents").select("file_path")
      .eq("id", id).eq("user_id", user.id).single();
    if (error || !document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    const { data, error: signingError } = await supabase.storage.from("personal-documents").createSignedUrl(document.file_path, 60);
    if (signingError || !data) throw new Error("File unavailable");
    return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Couldn't open this file. Please return to Files and try again." }, { status: 503 });
  }
}
