import type { NextConfig } from "next";

/**
 * Headers every page and API answer carries.
 *
 * These are the browser-side protections the site had nothing of: any other
 * website could load MemoValet inside an invisible frame and collect the
 * clicks of someone who thought they were using their own page, and every link
 * out of the app handed the full address — which carries meeting ids — to
 * whatever site was opened.
 *
 * Permissions-Policy is written as an allow-list on purpose: a call needs the
 * camera, the microphone and screen sharing, and the weather chip asks for
 * where you are, so those are allowed for MemoValet itself and refused to
 * anything embedded. Everything not named is off.
 */
const SECURITY_HEADERS = [
  // Nobody else's page may frame MemoValet. frame-ancestors is what current
  // browsers read; X-Frame-Options is the same rule for older ones.
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // A file MemoValet serves is the type it says it is, never guessed.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Another site learns that a visitor came from memovalet.com, never which
  // page — meeting and session ids live in the address.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=(self)",
      "display-capture=(self)",
      "geolocation=(self)",
      "payment=()",
      "usb=()",
      "serial=()",
      "bluetooth=()",
      "midi=()",
      "accelerometer=()",
      "magnetometer=()",
      "gyroscope=()",
      "idle-detection=()",
      "interest-cohort=()",
    ].join(", "),
  },
  // A window MemoValet opens can't reach back into the page that opened it.
  // Popups still work, which sign-in with Google and Stripe checkout need.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // Don't announce the framework and version to anyone scanning for a
  // version with a known hole.
  poweredByHeader: false,
  // No generated AGENTS.md in the repo.
  agentRules: false,
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  },
  // pdfkit reads its built-in font metrics (.afm) off disk at runtime, using a
  // path relative to its own package. Bundling it broke that path, so every
  // PDF on Vercel failed with ENOENT on Helvetica.afm. Keeping pdfkit external
  // makes it a real node_modules require again, and tracing its data folder
  // guarantees those files ship with the function.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/pdfkit/js/data/**", "./assets/pdf-fonts/**"],
    "/share/**": ["./node_modules/pdfkit/js/data/**", "./assets/pdf-fonts/**"],
  },
};

export default nextConfig;
