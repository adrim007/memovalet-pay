import { NextResponse } from "next/server";
import { readFileShare } from "@/lib/file-sharing";
import { createServiceClient } from "@/lib/supabase/service";
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const share = await readFileShare(token);
  const file = share?.files.find(item => item.id === id);
  if (!share || !file || !file.file_path.startsWith(`${share.owner_id}/`)) return NextResponse.json({ error: "File not available" }, { status: 404 });
  const inline = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mime_type || "");
  const { data, error } = await createServiceClient().storage.from("personal-documents").createSignedUrl(file.file_path, 60, { download: inline ? false : file.title });
  if (error || !data) return NextResponse.json({ error: "Couldn't open the file" }, { status: 503 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
