import { notFound } from "next/navigation";
import CommandCenterPreview from "@/components/CommandCenterPreview";

export const dynamic = "force-dynamic";

export default function CommandCenterPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_PRODUCT_PREVIEW !== "1"
  ) {
    notFound();
  }

  return <CommandCenterPreview />;
}
