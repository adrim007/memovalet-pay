"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkle, User, UsersThree } from "@phosphor-icons/react";

const plans = [
  { name: "Free", icon: Sparkle, tagline: "A clear place to begin.", monthly: 0, yearly: 0, summary: "Keep your everyday notes, files, tasks and calendar together in a personal workspace.", features: ["Personal calendar and work library", "Notes, files and basic tasks", "Join meetings and respond to tasks", "Upgrade when you need more"] },

  { name: "Member", icon: User, tagline: "For your individual work.", monthly: 19, yearly: 190, summary: "Manage your projects, keep useful records and coordinate work with clients.", features: ["Calendar, notes, files and personal tasks", "600 minutes of processed speech each month", "Search across your meeting history", "Exports and individual task tracking", "Send task links to clients"] },
  { name: "Business", icon: UsersThree, tagline: "For shared responsibilities.", monthly: 39, yearly: 390, summary: "Bring your team’s information and responsibilities together with shared workspaces and reporting.", features: ["Everything in Member", "1,200 minutes of processed speech per paid user each month", "Shared workspaces and team task tracking", "Completion evidence and team reporting", "Transcription allowance shared across assigned team seats", "Free guests. No minimum seats."] },
];

export default function PricingPlans({ paidOpen = true }: { paidOpen?: boolean }) {
  const [yearly, setYearly] = useState(false);

  return (
    <section className="memo-pricing-plans" aria-label="Pricing plans">
      <div className="memo-pricing-billing-row">
        <div className="memo-pricing-toggle" role="group" aria-label="Compare billing periods">
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly <span>Save with annual billing</span></button>
        </div>
<p>All prices in USD</p>
        <p>Transcription counts audio processed for each speaker. Allowances refresh on the first day of each month in UTC. Calls can continue after transcription minutes run out.</p>
        {/* While payments aren't connected, the paid plans say so. They used to
            offer "Start 14 day free trial", which sent people through sign-up
            to a greyed-out button. This switches back by itself once billing
            is configured (lib/billing billingReady). */}
        <p>{paidOpen
          ? "Keep using Free for as long as you like. Member and Business include a 14 day free trial with a card required. Cancel before your trial ends to avoid being charged."
          : "Keep using Free for as long as you like. Member and Business are opening soon, and everything you set up on Free stays with you when you upgrade."}</p>
      </div>
      <div className="memo-pricing-cards">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const paid = plan.monthly > 0;
          const featured = plan.name === "Member";
          const price = yearly && paid ? (plan.yearly / 12).toFixed(2) : String(plan.monthly);
          const checkout = `/billing?plan=${plan.name.toLowerCase()}&interval=${yearly ? "year" : "month"}`;
          return (
            <article key={plan.name} className={`memo-pricing-card${featured ? " memo-pricing-card-featured" : ""}`} aria-labelledby={`plan-${plan.name.toLowerCase()}`}>
              <div className="memo-pricing-card-top"><span className="memo-pricing-plan-icon"><Icon size={24} weight="duotone" aria-hidden="true" /></span><span className="memo-pricing-plan-tag">{featured ? "For your everyday" : plan.name === "Business" ? "Made for teams" : "Start here"}</span></div>
              <h2 id={`plan-${plan.name.toLowerCase()}`}>{plan.name}</h2>
              <p className="memo-pricing-tagline">{plan.tagline}</p>
              <div className="memo-pricing-price" aria-live="polite" aria-atomic="true"><span className="memo-pricing-amount">US${price}</span><span className="memo-pricing-unit">{plan.name === "Business" ? "per paid user / month" : "per month"}</span><p>{!paid ? "Free, with no expiry" : !paidOpen ? (yearly ? `US$${plan.yearly}${plan.name === "Business" ? " per paid user" : ""} a year, when paid plans open` : "Billed monthly, when paid plans open") : yearly ? `US$${plan.yearly}${plan.name === "Business" ? " per paid user" : ""}, billed yearly after your trial` : "Billed monthly after your trial"}</p></div>
              <p className="memo-pricing-card-description">{plan.summary}</p>
              <Link className={`memo-pricing-button${featured ? " memo-pricing-button-primary" : ""}`} href={paid && paidOpen ? checkout : "/login?mode=signup"}>{!paid ? "Get started free" : paidOpen ? "Start 14 day free trial" : "Start on Free for now"} <ArrowRight size={17} aria-hidden="true" /></Link>
              <p className="memo-pricing-card-status">{!paid ? "A free workspace you can keep" : paidOpen ? "Card required · Cancel before your trial ends" : "Paid plans are opening soon"}</p>
              <ul>{plan.features.map((feature) => <li key={feature}><Check size={17} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
