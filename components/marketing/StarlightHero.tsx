import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { CSSProperties } from "react";
import AnimatedElephant from "./AnimatedElephant";
import DemoVideoButton from "./DemoVideoButton";
import { GmailIcon, GoogleCalendarIcon, GoogleDocsIcon, GoogleMeetIcon, SlackIcon } from "./BrandIcons";
import "./StarlightHero.css";

export default function StarlightHero({ variant }: { variant: "solutions" | "resources" | "overview" | "integrations" }) {
  const resources = variant === "resources";
  const overview = variant === "overview";
  const integrations = variant === "integrations";
  const label = { resources: "Resources", solutions: "Solutions", overview: "Your everyday workspace", integrations: "Integrations" }[variant];
  return (
    <section className={`memo-starlight memo-starlight--${variant}`} aria-labelledby={`${variant}-heading`}>
      <div className="memo-starlight-sky" aria-hidden="true" />
      <div className="memo-starlight-inner">
        <div className="memo-starlight-copy">
          <p className="memo-starlight-label">MemoValet / {label}</p>
          <h1 id={`${variant}-heading`}>
            {resources ? <>Practical guidance.<br /><span>More confident work.</span></> : overview ? <>MemoValet.<br /><span>Your work.<br />All together.</span></> : integrations ? <>Your favourite tools.<br /><span>Better together.</span></> : <>Work your way.<br /><span>Keep it together.</span></>}
          </h1>
          <p className="memo-starlight-description">
            {resources
              ? "Learn how to plan your day, organise your library, assign tasks and collaborate with confidence."
              : overview ? "Bring tasks, projects, notes, files and conversations into one place for your personal and business work."
              : integrations ? "Connect supported tools to your workspace. Share useful records and keep the information your team needs within reach."
              : "From personal priorities to shared projects, MemoValet helps you organise information, coordinate responsibilities and track progress."}
          </p>
          {overview ? <DemoVideoButton /> : <a className="memo-starlight-cta" href={resources ? "#resource-library-heading" : integrations ? "#integration-directory-heading" : "#global-teams"}>
            {resources ? "Explore the library" : integrations ? "Explore connections" : "See MemoValet at work"}<ArrowRight size={20} aria-hidden="true" />
          </a>}
          {overview && <p className="memo-starlight-detail">Tasks and projects <span aria-hidden="true">/</span> Notes and files <span aria-hidden="true">/</span> People and conversations</p>}
        </div>
        {integrations ? <div className="memo-integration-flow memo-integration-refined" aria-label="MemoValet connections">
          <div className="memo-integration-flow-line" aria-hidden="true" />
          <div className="memo-integration-flow-center">
            <Image src="/assets/memovalet-mark.png" alt="" width={64} height={64} />
            <strong>MemoValet</strong>
          </div>
          {[{ Icon: GoogleMeetIcon, name: "Google Meet" }, { Icon: GoogleDocsIcon, name: "Google Docs" }, { Icon: SlackIcon, name: "Slack" }, { Icon: GmailIcon, name: "Gmail" }, { Icon: GoogleCalendarIcon, name: "Google Calendar" }].map(({ Icon, name }, index) => <a key={name} className="memo-integration-flow-app" href="#integration-directory-heading" aria-label={name} title={name} style={{ "--app-index": index } as CSSProperties}><Icon className="h-8 w-8" /></a>)}
        </div> : <div className="memo-starlight-mascot">
          <AnimatedElephant className="memo-starlight-elephant" parallaxDepth={0} resource={resources} fullBody={overview} sizes={resources ? "(max-width: 760px) 240px, 460px" : "(max-width: 760px) 280px, 560px"} />
        </div>}
      </div>
      <p className="memo-starlight-next">{integrations ? "Your tools. Your choice. Your next step." : resources ? "Find your next step in the library." : overview ? "Less catching up. More moving forward." : "Built around the way you work."}</p>
    </section>
  );
}
