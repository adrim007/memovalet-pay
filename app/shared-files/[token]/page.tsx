import Link from "next/link";
import Image from "next/image";
import { readFileShare } from "@/lib/file-sharing";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
  title: "Shared files · MemoValet",
};
export default async function SharedFilesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await readFileShare(token);
  if (!share)
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">This share isn’t available</h1>
        <p className="my-4">
          It may have expired, been removed, or require the recipient’s MemoValet account.
        </p>
        <Link href={`/login?next=${encodeURIComponent(`/shared-files/${token}`)}`}>
          Sign in to MemoValet
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-10">
      <p className="font-semibold text-violet-600">MemoValet</p>
      <h1 className="mt-5 text-3xl font-semibold">Shared with you</h1>
      <p className="my-4 whitespace-pre-wrap">{share.message}</p>
      <p className="mb-6 text-sm text-[var(--muted)]">
        View-only · expires {new Date(share.expires_at).toLocaleDateString("en-AU")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {share.files.map((file) => (
          <a
            key={file.id}
            href={`/api/shared-files/${token}/${file.id}`}
            className="surface-card rounded-2xl p-4"
          >
            {["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.mime_type || "") && (
              <Image src={`/api/shared-files/${token}/${file.id}`} alt={file.title} width={640} height={400} unoptimized className="mb-4 h-48 w-full rounded-xl bg-violet-500/5 object-contain" />
            )}
            <p className="font-medium">{file.title}</p>
            <p className="mt-2 text-sm text-violet-600">Open file →</p>
          </a>
        ))}
      </div>
    </main>
  );
}
