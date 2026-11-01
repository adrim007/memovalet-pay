import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";
import { isUKSpelling } from "@/lib/locale";
import { SpellingProvider } from "@/lib/spelling-context";
import ErrorReporter from "@/components/ErrorReporter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const siteUrl = "https://memovalet.com";
// What search results and link previews say. MemoValet is a personal
// assistant for work and life; meetings are one of the things it does, not
// what it is (see tests/marketing-claims).
const title = "MemoValet | Your personal assistant for work and life";
const description =
  "MemoValet keeps your tasks, promises, notes, files, calendar and people together, shows you what needs you each day, and takes the notes in your meetings, in 21 languages.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "MemoValet",
  // The preview image itself comes from app/opengraph-image.tsx.
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "MemoValet",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const useUK = await isUKSpelling();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* Says so when something breaks in front of somebody. */}
        <ErrorReporter />
        <SpellingProvider useUK={useUK}>{children}</SpellingProvider>
      </body>
    </html>
  );
}
