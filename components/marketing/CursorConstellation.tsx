"use client";

import { useEffect, useRef } from "react";

const STAR_COUNT = 64;
const RAY_COUNT = 34;

type CursorConstellationProps = {
  scopeSelector?: string;
  className?: string;
  parallax?: boolean;
  cursorLight?: boolean;
};

export default function CursorConstellation({
  scopeSelector = ".mf-space-hero",
  className = "mf-cursor-constellation",
  parallax = true,
  cursorLight = true,
}: CursorConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest<HTMLElement>(scopeSelector);
    const context = canvas?.getContext("2d");
    if (!canvas || !section || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 992px)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let active = false;
    let phase = 0;
    // How quickly the light closes the gap to the cursor, and how quickly it
    // fades in and out. Both are per-second rates, applied through an
    // exponential ease below, so the motion is identical on a 60Hz and a
    // 120Hz display instead of running twice as fast on the latter.
    const FOLLOW_RATE = 7.5;
    const FADE_RATE = 5;
    let intensity = 0;
    let lastTime = 0;
    // Sample once per mount so resizing preserves an irregular star field.
    const stars = Array.from({ length: 320 }, () => ({
      x: Math.random(), y: Math.random(),
      radius: 0.5 + Math.pow(Math.random(), 3) * 1.5,
      alpha: 0.3 + Math.random() * 0.6,
      glint: Math.random() < 0.04,
      color: Math.random() < 0.2 ? "224, 208, 255" : "222, 238, 255",
    }));

    const parallaxLayers = () =>
      Array.from(section.querySelectorAll<HTMLElement>("[data-mf-parallax]"));

    const draw = () => {
      context.clearRect(0, 0, width, height);

      const scaledStarCount = Math.min(
        320,
        Math.max(STAR_COUNT, Math.round((height / 620) * STAR_COUNT)),
      );

      for (let index = 0; index < scaledStarCount; index += 1) {
        const star = stars[index];
        const x = star.x * width;
        const y = star.y * height;
        const radius = star.radius;
        context.fillStyle = `rgba(${star.color}, ${star.alpha})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        if (star.glint) {
          context.beginPath();
          context.moveTo(x - 3.5, y);
          context.lineTo(x + 3.5, y);
          context.moveTo(x, y - 3.5);
          context.lineTo(x, y + 3.5);
          context.lineWidth = 0.65;
          context.strokeStyle = "rgba(221, 231, 255, 0.5)";
          context.stroke();
        }
      }

      // Fully faded out: nothing to draw, and no wasted canvas work.
      if (!cursorLight || intensity < 0.01) return;

      // One alpha for the whole light, so it eases in and out as a unit
      // rather than blinking on the moment the pointer enters or leaves.
      context.globalAlpha = intensity;

      const glow = context.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, 48);
      glow.addColorStop(0, "rgba(255, 255, 255, 0.68)");
      glow.addColorStop(0.12, "rgba(146, 112, 255, 0.3)");
      glow.addColorStop(1, "rgba(105, 76, 255, 0)");
      context.fillStyle = glow;
      context.fillRect(pointerX - 48, pointerY - 48, 96, 96);

      for (let index = 0; index < RAY_COUNT; index += 1) {
        const angle = (index / RAY_COUNT) * Math.PI * 2 + Math.sin(index * 1.73) * 0.045;
        const length = 48 + ((index * 37) % 142) + Math.sin(phase + index) * 5;
        context.beginPath();
        context.moveTo(pointerX + Math.cos(angle) * 9, pointerY + Math.sin(angle) * 9);
        context.lineTo(pointerX + Math.cos(angle) * length, pointerY + Math.sin(angle) * length);
        context.lineWidth = index % 8 === 0 ? 1.15 : 0.55;
        context.strokeStyle = index % 5 === 0
          ? "rgba(94, 194, 255, 0.22)"
          : "rgba(141, 105, 255, 0.2)";
        context.stroke();
      }

      context.shadowBlur = 12;
      context.shadowColor = "rgba(164, 132, 255, 0.9)";
      context.fillStyle = "rgba(255, 255, 255, 0.95)";
      context.beginPath();
      context.arc(pointerX, pointerY, 2.6, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    };

    const resize = () => {
      const rect = section.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      pointerX = targetX = width * 0.45;
      pointerY = targetY = Math.min(150, height * 0.2);
      active = reducedMotion.matches;
      // With reduced motion there is no animation loop to ease `intensity`
      // up, so show the light at full strength straight away.
      if (reducedMotion.matches) intensity = 1;
      draw();
    };

    const animate = (now: number) => {
      // Clamped so a backgrounded tab returning after seconds doesn't
      // teleport the light across the screen in one jump.
      const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60;
      lastTime = now;

      // 1 - e^(-rate * dt) is the frame-rate-independent form of a lerp:
      // the same easing curve whatever the refresh rate or a dropped frame.
      const follow = 1 - Math.exp(-FOLLOW_RATE * delta);
      pointerX += (targetX - pointerX) * follow;
      pointerY += (targetY - pointerY) * follow;

      const fade = 1 - Math.exp(-FADE_RATE * delta);
      intensity += ((active ? 1 : 0) - intensity) * fade;

      phase += delta * 1.08;
      draw();
      frame = window.requestAnimationFrame(animate);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!desktop.matches || reducedMotion.matches || event.pointerType === "touch") return;
      const rect = section.getBoundingClientRect();
      const localX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const localY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      targetX = localX;
      targetY = localY;
      active = true;

      const horizontal = localX / Math.max(rect.width, 1) - 0.5;
      const vertical = Math.max(
        -0.5,
        Math.min(0.5, localY / Math.max(Math.min(rect.height, window.innerHeight), 1) - 0.5),
      );
      if (parallax) {
        parallaxLayers().forEach((layer) => {
          const depth = Number(layer.dataset.mfParallax ?? 6);
          // Eased in CSS rather than snapped to each pointer event, so the
          // background drifts with the light instead of twitching with it.
          if (!layer.style.transition) {
            layer.style.transition = "translate 620ms cubic-bezier(0.22, 1, 0.36, 1)";
          }
          layer.style.translate = `${horizontal * depth}px ${vertical * depth}px`;
        });
      }
    };

    const onPointerLeave = () => {
      active = false;
      if (parallax) {
        parallaxLayers().forEach((layer) => {
          layer.style.translate = "0px 0px";
        });
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(section);
    section.addEventListener("pointermove", onPointerMove, { passive: true });
    section.addEventListener("pointerleave", onPointerLeave);
    resize();
    if (cursorLight && !reducedMotion.matches && desktop.matches) frame = window.requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerleave", onPointerLeave);
      window.cancelAnimationFrame(frame);
      onPointerLeave();
    };
  }, [parallax, scopeSelector, cursorLight]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
