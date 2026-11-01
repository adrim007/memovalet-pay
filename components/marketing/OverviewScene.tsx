import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import "./StarlightHero.css";

/**
 * The first thing anyone sees: MemoValet is a personal assistant for work and
 * life. Not a meeting app — meetings are one thing it does, and they get one
 * section further down, never the headline. (It led with meetings for one
 * day, and that was wrong; see tests/marketing-claims.) The elephant scene
 * stays; it is the brand, and a valet is someone who takes care of things.
 */
const PROOF = ["Your day in one view", "Jobs sent by link", "Meetings in 21 languages"];

export default function OverviewScene() {
  return (
    <section className="memo-approved-hero" aria-labelledby="overview-heading-hero">
      <div className="memo-approved-art">
        {/* A WebP copy of the approved scene: 109 KB instead of the 1.7 MB PNG,
            with no visible difference. Still unoptimized, so the sky is never
            re-compressed into bands. The PNG stays for app/opengraph-image. */}
        <Image src="/assets/overview-approved-scene.webp" alt="MemoValet elephant on a glowing horizon beneath the stars" fill priority unoptimized sizes="100vw" />
      </div>
      <div className="memo-approved-copy">
        <p className="memo-starlight-label">Your personal assistant</p>
        <h1 id="overview-heading-hero">Everything on<br />your plate,<br /><span>taken care of.</span></h1>
        <p className="memo-starlight-description">
          MemoValet is a personal assistant for your work and life. It keeps your tasks, promises, notes, files and people in one place, shows you what needs you each day, and takes the notes when you meet.
        </p>
        <div className="memo-hero-actions">
          <Link className="memo-starlight-cta" href="/login?mode=signup">
            Start free <ArrowRight size={20} aria-hidden="true" />
          </Link>
          {/* One call to action. The dashboard section further down plays the
              walkthrough; Adrian asked for no film button up here. */}
        </div>
        <ul className="memo-hero-proof" aria-label="What you get">
          {PROOF.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </section>
  );
}
