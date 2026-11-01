import { notFound } from "next/navigation";

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_PRODUCT_PREVIEW !== "1"
  ) {
    notFound();
  }

  return children;
}
