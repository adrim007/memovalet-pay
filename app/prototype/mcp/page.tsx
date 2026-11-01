import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MemoValetMcpPrototypePage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PRODUCT_PREVIEW !== "1") notFound();
  redirect("/preview?scenario=launch");
}
