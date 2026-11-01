"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const GAP = 8;
const VIEWPORT_MARGIN = 8;

/**
 * Puts a small menu or confirmation in the browser's top page layer while
 * keeping it visually attached to its trigger. Portalling is important here:
 * frosted cards use backdrop-filter, which creates a separate stacking context
 * and would otherwise let the next card paint over the open panel.
 */
export default function AnchoredOverlay({
  open,
  anchorRef,
  panelRef,
  className,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  className: string;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const anchorBox = anchor.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, anchorBox.right - panelBox.width),
      window.innerWidth - panelBox.width - VIEWPORT_MARGIN
    );
    const below = anchorBox.bottom + GAP;
    const above = anchorBox.top - panelBox.height - GAP;
    const top =
      below + panelBox.height <= window.innerHeight - VIEWPORT_MARGIN
        ? below
        : Math.max(VIEWPORT_MARGIN, above);

    setPosition({ left, top });
  }, [anchorRef, panelRef]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed z-[100] ${className}`}
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  );
}
