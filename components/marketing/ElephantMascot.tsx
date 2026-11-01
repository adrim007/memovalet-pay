import Image from "next/image";
import { useId } from "react";

export default function ElephantMascot({ className, sizes = "(max-width: 540px) 300px, 380px", resource = false, fullBody = false }: { className?: string; sizes?: string; resource?: boolean; fullBody?: boolean }) {
  const filterId = `mascot-background-${useId().replace(/:/g, "")}`;
  return (
    <>
    <svg width="0" height="0" aria-hidden="true" className="absolute"><defs>
      <filter id={filterId} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 16 0 -1.4" />
      </filter>
    </defs></svg>
    <Image
      src={fullBody ? "/assets/memovalet-overview-elephant.png" : "/assets/memovalet-elephant-sculpted.png"}
      alt="MemoValet elephant assistant"
      width={1254}
      height={1254}
      priority
      unoptimized={fullBody || resource}
      sizes={sizes}
      style={{ filter: fullBody ? undefined : `url(#${filterId})`, transform: resource ? "none" : "scaleX(-1)" }}
      className={`object-contain ${className ?? ""}`}
    />
    </>
  );
}
