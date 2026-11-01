"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, CheckCircle, Sparkle, Waveform } from "@phosphor-icons/react";
import { GmailIcon, GoogleCalendarIcon, GoogleDocsIcon } from "./BrandIcons";
import styles from "./MeetingBriefShowcase.module.css";

const tabs = ["Summary", "Decisions", "Actions"] as const;
const people = ["sarah", "mike", "alex", "wei"];

export default function MeetingBriefShowcase() {
  const [active, setActive] = useState<(typeof tabs)[number]>("Summary");
  return (
    <section id="meeting-brief" className={styles.section} aria-labelledby="summary-heading">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}><Sparkle size={16} weight="fill" /> KEEP DECISIONS CONNECTED TO WORK</span>
          <h2 id="summary-heading">Capture context.<br />Clarify decisions.<br /><span>Assign the work.</span></h2>
          <p>Keep a useful record of project conversations. Review the summary, confirm decisions and turn agreed actions into tasks with clear responsibilities.</p>
          <Link href="/login?mode=signup" className={styles.cta}>Create your workspace <ArrowUpRight size={20} /></Link>
          <div className={styles.steps}><span>01 / Capture</span><span>02 / Understand</span><span>03 / Act</span></div>
        </div>
        <div className={styles.preview} aria-label="Example meeting brief">
          <div className={styles.topline}><span><span className={styles.statusDot} /> PROJECT CONVERSATION</span><span>EXAMPLE BRIEF</span></div>
          <div className={styles.meeting}>
            <div><p className={styles.project}>ACME / PRODUCT TEAM</p><h3>Project kickoff</h3><p className={styles.meta}>Friday, 10:00 am <span>/</span> 32 min <span>/</span> 4 people</p></div>
            <div className={styles.avatars}>{people.map(name => <Image key={name} src={`/avatars/${name}.jpg`} alt="" width={36} height={36} />)}</div>
          </div>
          <div className={styles.signal}>
            <Waveform size={20} /><div className={styles.wave} aria-hidden="true">{Array.from({length: 48}, (_, i) => <i key={i} style={{height: `${7 + ((i * 17 + i * i) % 25)}px`, animationDelay: `${i * -0.09}s`}} />)}</div><span><Check size={12} /> Captured</span>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Meeting brief">
            {tabs.map((tab, index) => <button key={tab} id={`brief-tab-${tab}`} role="tab" type="button" aria-selected={active === tab} aria-controls="brief-panel" tabIndex={active === tab ? 0 : -1} onClick={() => setActive(tab)} onKeyDown={event => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
              setActive(tabs[next]);
              document.getElementById(`brief-tab-${tabs[next]}`)?.focus();
            }}>{tab}<span>{index === 0 ? "01" : "03"}</span></button>)}
          </div>
          <div className={styles.content} id="brief-panel" role="tabpanel" aria-labelledby={`brief-tab-${active}`} tabIndex={0}>
            {active === "Summary" ? <div className={styles.reveal}><span className={styles.contentLabel}><Sparkle size={16} /> THE BIG PICTURE</span><h4>Project priorities.<br />Clear next steps.</h4><p>The team aligned on Q3 scope and the Acme rollout. Design will refine onboarding next sprint, while engineering confirms the timeline before Friday.</p><div className={styles.takeaway}><CheckCircle size={18} weight="fill" /><span>One direction. Three clear next steps.</span></div></div> :
              active === "Decisions" ? <div className={styles.reveal}><span className={styles.contentLabel}><CheckCircle size={16} /> AGREED IN THE ROOM</span><ul className={styles.list}>{["Keep the Q3 rollout focused on core onboarding.", "Start the design update in the next sprint.", "Confirm engineering feasibility before Friday."].map((text, i) => <li key={text}><span className={styles.number}>0{i + 1}</span><p>{text}</p></li>)}</ul></div> :
              <div className={styles.reveal}><span className={styles.contentLabel}><CheckCircle size={16} /> EVERY NEXT STEP, OWNED</span><ul className={styles.list}>{[["mike", "Confirm timeline feasibility", "Mike", "Friday"], ["sarah", "Refine onboarding flow", "Sarah", "Next sprint"], ["alex", "Share the rollout brief", "Alex", "Today"]].map(([avatar, title, name, due]) => <li key={title}><Image src={`/avatars/${avatar}.jpg`} alt="" width={28} height={28} /><div><p>{title}</p><small>{name} <span>/</span> {due}</small></div></li>)}</ul></div>}
          </div>
          <div className={styles.footer}><span>Keep the work moving</span><div>{[[GoogleDocsIcon, "Google Docs"], [GmailIcon, "Gmail"], [GoogleCalendarIcon, "Google Calendar"]].map(([Icon, name]) => {
            const Brand = Icon as typeof GmailIcon;
            return <span key={name as string} title={name as string} aria-label={name as string}><Brand className={styles.brand} /></span>;
          })}</div><ArrowUpRight size={18} aria-hidden="true" /></div>
        </div>
      </div>
    </section>
  );
}
