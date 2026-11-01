"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "@phosphor-icons/react";
import { AD_FILM, type Film } from "@/lib/films";

/**
 * One of MemoValet's films (lib/films.ts), in a dialog.
 *
 * A phone held upright gets the film's vertical cut, if it has one, instead
 * of a letterboxed strip of the wide one. The choice is made when the dialog
 * opens, in the browser, where the screen's shape is known.
 */
export default function DemoVideoButton({ film = AD_FILM, className, label = "Watch the film" }: { film?: Film; className?: string; label?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ids = `memovalet-film-${film.wide.replace(/\W+/g, "-")}`;

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const openFilm = () => {
    setPortrait(Boolean(film.tall) && window.matchMedia("(orientation: portrait) and (max-width: 760px)").matches);
    setIsOpen(true);
  };

  const closeFilm = () => {
    videoRef.current?.pause();
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openFilm}
        className={
          className ??
          "inline-flex min-h-13 w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-white/24 bg-white/[0.025] px-7 text-sm font-medium text-white/76 transition hover:border-[#8d73ff]/75 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a98cff] sm:w-auto"
        }
        aria-haspopup="dialog"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/12">
          <Play size={13} weight="fill" aria-hidden="true" />
        </span>
        {label}
        {film.length ? <span className="sr-only">, {film.length}</span> : null}
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-[#05050d]/88 p-4 backdrop-blur-md sm:p-8"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeFilm();
            }}
            role="presentation"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${ids}-title`}
              aria-describedby={`${ids}-description`}
              className={`relative w-full overflow-hidden rounded-[24px] border border-white/15 bg-[#090916] shadow-[0_34px_120px_rgba(0,0,0,0.72),0_0_60px_rgba(113,75,255,0.18)] ${portrait ? "max-w-[440px]" : "max-w-[1180px]"}`}
            >
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#aa8cff]">{film.eyebrow}</p>
                  <h2 id={`${ids}-title`} className="mt-1 text-base font-semibold text-white sm:text-lg">
                    {film.title}
                  </h2>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closeFilm}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/72 transition hover:border-white/25 hover:bg-white/[0.12] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a98cff]"
                  aria-label="Close the film"
                >
                  <X size={18} weight="bold" aria-hidden="true" />
                </button>
              </div>

              <div className="bg-black">
                <video
                  ref={videoRef}
                  className={`w-full ${portrait ? "aspect-[9/16] max-h-[76vh]" : "aspect-video"}`}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  poster={portrait && film.posterTall ? film.posterTall : film.poster}
                >
                  <source src={portrait && film.tall ? film.tall : film.wide} type="video/mp4" />
                  {film.captions ? <track kind="captions" src={film.captions} srcLang="en" label="English" /> : null}
                  Your browser can&apos;t play this video.
                </video>
              </div>
              <p id={`${ids}-description`} className="sr-only">{film.description}</p>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
