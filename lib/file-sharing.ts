import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const hashShareToken = (token: string) => createHash("sha256").update(token).digest("hex");
export async function readFileShare(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const service = createServiceClient();
  const { data: share, error } = await service
    .from("file_shares")
    .select("id,owner_id,recipient_id,document_ids,message,expires_at,revoked_at")
    .eq("token_hash", hashShareToken(token))
    .maybeSingle();
  if (error || !share || share.revoked_at || Date.parse(share.expires_at) <= Date.now())
    return null;
  if (share.recipient_id) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || (user.id !== share.recipient_id && user.id !== share.owner_id)) return null;
  }
  const files = await service
    .from("documents")
    .select("id,title,file_path,mime_type")
    .eq("user_id", share.owner_id)
    .in("id", share.document_ids);
  if (files.error) return null;
  return { ...share, files: files.data || [] };
}
