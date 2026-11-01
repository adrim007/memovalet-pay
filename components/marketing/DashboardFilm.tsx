"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Play, SpeakerSlash } from "@phosphor-icons/react";
import { WALKTHROUGH_FILM } from "@/lib/films";

export type DashboardPart = { title: string; body: string; at: { left: string; top: string } };

/**
 * The walkthrough, right in the dashboard section. It starts by itself as
 * soon as half of it is on screen, out loud whenever the browser allows it.
 * Browsers hold back sound until the visitor has clicked or tapped (unless
 * they visit often), so then it starts silently, its words on screen anyway,
 * and the visitor's first click, tap or key press anywhere on the page turns
 * the sound on while it keeps playing. A small speaker in the corner shows it
 * is quiet until then. (No running time on it: Adrian asked for it not to say
 * how long.)
 *
 * Anyone who has asked their device for less motion, or to save data, gets
 * the dashboard screenshot as its cover instead, with numbered markers
 * pointing at the parts listed underneath, and presses it to play.
 *
 * The screenshot (2200 × 1467) sits in the film's 16:9 frame, aligned to the
 * top, so a marker's `top` is measured again against the frame's height.
 */
const SHOT = { w: 2200, h: 1467 };
const FRAME_H = (SHOT.w * 9) / 16;
const inFrame = (top: string) => `${(parseFloat(top) * SHOT.h) / FRAME_H}%`;

function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const noSubscription = () => () => {};
const savingData = () => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

export default function DashboardFilm({ parts }: { parts: DashboardPart[] }) {
  const film = WALKTHROUGH_FILM;
  const figureRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pressed, setPressed] = useState(false);
  const [sound, setSound] = useState(false);
  // Decided in the browser, where the screen's shape and the visitor's settings are known.
  const inBrowser = useSyncExternalStore(noSubscription, () => true, () => false);
  const calm = useMedia("(prefers-reduced-motion: reduce)");
  const saveData = useSyncExternalStore(noSubscription, savingData, () => false);
  const auto = inBrowser && !calm && !saveData;
  const showing = auto || pressed;
  // A phone held upright plays the version filmed on the phone layout, in a
  // tall frame, instead of a small strip of the wide one.
  const portrait = useMedia("(orientation: portrait) and (max-width: 760px)");
  const tall = Boolean(film.tall) && portrait && showing;

  // Plays while at least half of it is on screen, and pauses when it isn't.
  useEffect(() => {
    const figure = figureRef.current, video = videoRef.current;
    if (!figure || !video) return;
    const watcher = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        video.pause();
        return;
      }
      // Out loud if the browser allows it; if not, silently until the first tap.
      video.muted = false;
      video.play().then(() => setSound(true), () => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }, { threshold: 0.5 });
    watcher.observe(figure);
    return () => watcher.disconnect();
  }, [showing, tall]);

  const hear = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      if (!video.paused) video.play().catch(() => {});
    }
    setSound(true);
  };

  // The visitor's first click, tap or key press anywhere lets the browser play
  // sound, so the film is unmuted right then and keeps going.
  useEffect(() => {
    if (!auto || sound) return;
    document.addEventListener("pointerdown", hear);
    document.addEventListener("keydown", hear);
    return () => {
      document.removeEventListener("pointerdown", hear);
      document.removeEventListener("keydown", hear);
    };
  }, [auto, sound]);

  return (
    <figure ref={figureRef} className="relative mt-14">
      <div className={`relative overflow-hidden rounded-[22px] border border-white/15 bg-white/5 p-1.5 shadow-[0_60px_160px_-50px_rgba(119,85,239,0.75)] sm:rounded-[28px] sm:p-2 ${tall ? "mx-auto max-w-[440px]" : ""}`}>
        <div className={`relative overflow-hidden rounded-[16px] bg-black sm:rounded-[20px] ${tall ? "aspect-[9/16] max-h-[82vh]" : "aspect-video"}`}>
          {showing ? (
            <>
              <video
                key={tall ? "tall" : "wide"}
                ref={videoRef}
                className="absolute inset-0 h-full w-full"
                muted={!sound}
                controls={sound}
                playsInline
                preload="metadata"
                poster={tall && film.posterTall ? film.posterTall : film.poster}
                aria-label={film.title}
                aria-describedby="dashboard-film-description"
              >
                <source src={tall && film.tall ? film.tall : film.wide} type="video/mp4" />
                Your browser can&apos;t play this video.
              </video>
              {!sound && (
                <button
                  type="button"
                  onClick={hear}
                  aria-label="Turn the sound on"
                  title="Turn the sound on"
                  className="absolute right-3 top-3 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-[#0b0a1f]/70 text-white shadow-lg backdrop-blur transition hover:bg-[#0b0a1f]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a98cff] sm:right-4 sm:top-4"
                >
                  <SpeakerSlash size={20} weight="fill" aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setPressed(true); setSound(true); }}
              className="group absolute inset-0 block h-full w-full cursor-pointer bg-[#f4f3fb] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a98cff]"
              aria-label={`Play: ${film.eyebrow.toLowerCase()}`}
              aria-describedby="dashboard-film-description"
            >
              <Image
                src="/assets/dashboard-showcase.webp"
                alt=""
                fill
                sizes="(max-width: 1200px) 100vw, 1152px"
                unoptimized
                className="object-cover object-top [mask-image:linear-gradient(#000_80%,transparent)]"
              />
              {parts.map((part, index) => (
                <span
                  key={part.title}
                  aria-hidden="true"
                  style={{ left: part.at.left, top: inFrame(part.at.top) }}
                  className="absolute hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-[#7755ef] to-[#c04fd8] text-sm font-bold text-white shadow-[0_0_0_4px_rgba(255,255,255,0.9),0_8px_24px_rgba(119,85,239,0.55)] sm:grid"
                >
                  {index + 1}
                </span>
              ))}
              {/* The play button, over the middle of the dashboard. */}
              <span className="absolute inset-0 grid place-items-center bg-[#0b0a1f]/10 transition group-hover:bg-[#0b0a1f]/20">
                <span className="flex flex-col items-center gap-3">
                  <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#7755ef] to-[#c04fd8] text-white shadow-[0_0_0_8px_rgba(255,255,255,0.55),0_20px_50px_rgba(76,50,190,0.55)] transition group-hover:scale-105 sm:h-24 sm:w-24">
                    <Play size={34} weight="fill" className="translate-x-0.5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-[#0b0a1f]/80 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur">
                    Watch how it works
                  </span>
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
      <figcaption id="dashboard-film-description" className="sr-only">
        {film.description}
      </figcaption>
    </figure>
  );
}
