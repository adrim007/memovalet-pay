import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hashShareToken } from "@/lib/file-sharing";
import { findUserIdByEmail, createNotification } from "@/lib/database";
import { sendAppEmail } from "@/lib/email/send";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const body = await req.json();
    const ids = Array.isArray(body.documentIds) ? [...new Set(body.documentIds)] : [];
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    if (
      !ids.length ||
      ids.length > 10 ||
      ids.some((id) => typeof id !== "string") ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ||
      !["memovalet", "email"].includes(body.mode)
    )
      return NextResponse.json(
        { error: "Select 1–10 files and enter a valid recipient" },
        { status: 400 }
      );
    const files = await supabase
      .from("documents")
      .select("id,title")
      .eq("user_id", user.id)
      .in("id", ids);
    if (files.error || files.data?.length !== ids.length)
      return NextResponse.json({ error: "You can share only files you own" }, { status: 403 });
    const recipientId = body.mode === "memovalet" ? await findUserIdByEmail(email) : null;
    if (body.mode === "memovalet" && !recipientId)
      return NextResponse.json(
        { error: "No MemoValet account was found. Choose Email to send a viewing link instead." },
        { status: 400 }
      );
    const token = randomBytes(32).toString("hex");
    const service = createServiceClient();
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const saved = await service
      .from("file_shares")
      .insert({
        owner_id: user.id,
        recipient_id: recipientId,
        token_hash: hashShareToken(token),
        document_ids: ids,
        message,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (saved.error || !saved.data) throw new Error("The share could not be created");
    const path = `/shared-files/${token}`;
    const url = new URL(path, req.url).toString();
    if (recipientId) {
      const notified = await createNotification({
        userId: recipientId,
        type: "file_shared",
        title: `${files.data.length} file(s) shared with you`,
        body: message || "Open to view the shared files.",
        link: path,
      });
      return NextResponse.json({ id: saved.data.id, url, shared: true, expiresAt, error: notified ? undefined : "Share created, but a notification wasn't delivered. Copy the account-restricted link to send it, or revoke access." });
    }
    const sent = await sendAppEmail({
      to: email,
      subject: "Files shared with you on MemoValet",
      text: `${message}\n\n${files.data.map((file) => file.title).join("\n")}\n\nView the files: ${url}\n\nThis link expires in 7 days. Anyone with the link can view these selected files until it expires or is revoked.`,
      userId: user.id,
    });
    return NextResponse.json({
      id: saved.data.id,
      url,
      shared: true,
      emailed: sent.sent,
      expiresAt,
      error: sent.sent
        ? undefined
        : "Share created, but the email was not sent. You can copy the link or revoke it.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Couldn't share these files. Please try again." },
      { status: 503 }
    );
  }
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  const result = await createServiceClient()
    .from("file_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id || "")
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (result.error || !result.data)
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  return NextResponse.json({ revoked: true });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const result = await supabase
    .from("file_shares")
    .select("id,message,expires_at,revoked_at,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (result.error)
    return NextResponse.json({ error: "File shares aren't available yet" }, { status: 503 });
  return NextResponse.json({
    shares: (result.data || []).map((share) => ({
      ...share,
      expired: Date.parse(share.expires_at) <= Date.now(),
    })),
  });
}
