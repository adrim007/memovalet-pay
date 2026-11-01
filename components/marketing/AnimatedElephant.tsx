"use client";

import { useRef } from "react";
import ElephantMascot from "./ElephantMascot";
import "./MascotPolish.css";

export default function AnimatedElephant({
  className = "",
  parallaxDepth = 10,
  sizes,
  resource = false,
  fullBody = false,
}: {
  className?: string;
  parallaxDepth?: number;
  sizes?: string;
  resource?: boolean;
  fullBody?: boolean;
}) {
  const tiltRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const horizontal = (event.clientX - rect.left) / rect.width - 0.5;
    const vertical = (event.clientY - rect.top) / rect.height - 0.5;
    const node = tiltRef.current;

    if (!node) return;
    node.style.setProperty("--elephant-x", `${horizontal * 18}px`);
    node.style.setProperty("--elephant-y", `${vertical * 11}px`);
    node.style.setProperty("--elephant-turn", `${horizontal * 5}deg`);
    node.style.setProperty("--elephant-pitch", `${-vertical * 8}deg`);
    node.style.setProperty("--elephant-yaw", `${horizontal * 10}deg`);
  }

  function resetPointerPosition() {
    const node = tiltRef.current;

    if (!node) return;
    node.style.setProperty("--elephant-x", "0px");
    node.style.setProperty("--elephant-y", "0px");
    node.style.setProperty("--elephant-turn", "0deg");
    node.style.setProperty("--elephant-pitch", "0deg");
    node.style.setProperty("--elephant-yaw", "0deg");
  }

  return (
    <div
      className={`landing-elephant-stage ${className}`}
      data-mf-parallax={parallaxDepth}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointerPosition}
    >
      <div ref={tiltRef} className="landing-elephant-tilt">
        <div className="landing-elephant-bob">
          <ElephantMascot sizes={sizes} resource={resource} fullBody={fullBody} className="h-full w-full drop-shadow-[0_20px_34px_rgba(98,68,240,0.38)]" />
        </div>
      </div>
    </div>
  );
}
