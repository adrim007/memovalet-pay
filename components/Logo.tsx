import Image from "next/image";
import Link from "next/link";

const sizes = {
  sm: { tile: "h-9 w-11", tilePop: "h-10 w-12", text: "text-xl" },
  md: { tile: "h-7 w-9", tilePop: "h-8 w-10", text: "text-base" },
  lg: { tile: "h-11 w-14", tilePop: "h-14 w-16", text: "text-xl" },
} as const;

interface LogoProps {
  size?: keyof typeof sizes;
  href?: string | null;
  wordmarkClassName?: string;
  /** Stronger layered shadow (contact shadow + colour glow) instead of the
   * default single soft shadow — for hero/standalone spots like the login
   * page, where the extra depth reads as intentional rather than heavy. */
  pop?: boolean;
  brandName?: string;
}

export default function Logo({ size = "md", href = "/", wordmarkClassName, pop = false, brandName = "MemoValet" }: LogoProps) {
  const currentSize = sizes[size];
  const content = (
    <span className="flex shrink-0 items-center gap-2.5">
      {/* Genuinely transparent cutout (background-removed from the original
          3D render, which had an opaque white backing) — floats directly on
          whatever it's placed on, no tile/box needed. A soft drop-shadow
          keeps it from looking flat instead of trying to fake depth with a
          background card. */}
      <span className={`relative shrink-0 ${pop ? currentSize.tilePop : currentSize.tile}`}>
        <Image
          src="/assets/memovalet-mark.png"
          alt=""
          fill
          sizes="64px"
          priority
          className={
            pop
              ? "object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] drop-shadow-[0_8px_10px_rgba(0,0,0,0.4)] drop-shadow-[0_0_22px_rgba(139,92,246,0.65)]"
              : "object-contain drop-shadow-[0_3px_8px_rgba(124,58,237,0.35)]"
          }
        />
      </span>
      {/* No color set here on purpose — inherits from whatever container
          it's placed in (dark text on the light login card via that card's
          own color, light text automatically in dark mode elsewhere) so it
          never goes invisible against a mismatched background. */}
      <span className={`font-extrabold tracking-tight ${currentSize.text} ${wordmarkClassName ?? ""}`}>
        {brandName}
      </span>
    </span>
  );

  if (!href) return content;
  return <Link href={href} className="inline-flex" aria-label={brandName}>{content}</Link>;
}
