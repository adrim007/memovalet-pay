import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Plus } from "@phosphor-icons/react/dist/ssr";
import MarketingPageShell from "@/components/marketing/MarketingPageShell";
import PricingPlans from "@/components/marketing/PricingPlans";
import "@/components/marketing/Pricing.css";
import { billingReady } from "@/lib/billing";

export const metadata: Metadata = {
  title: "Pricing | MemoValet",
  description: "Compare MemoValet's Free, Member and Business plans for meetings, tasks, projects, files and collaboration. Free has no expiry. Prices are in US dollars.",
  alternates: { canonical: "https://memovalet.com/pricing" },
  openGraph: {
    title: "One workspace. A plan for your work. | MemoValet",
    description: "Choose Free, Member or Business. Keep your meetings, tasks, projects, files and conversations together.",
    url: "https://memovalet.com/pricing",
  },
};

const comparison = (paidOpen: boolean) => [
  { label: "Free access", values: ["No expiry", paidOpen ? "14 day trial" : "Opening soon", paidOpen ? "14 day trial" : "Opening soon"] },
  { label: "Calendar, library and tasks", values: [true, true, true] },
  { label: "Projects and meeting records", values: [false, true, true] },
  { label: "Individual task tracking", values: [true, true, true] },
  { label: "Shared workspaces and team reporting", values: [false, false, true] },
];
// While payments aren't connected, the questions are about what is true now.
const faqsBeforeLaunch = [
  { question: "When can I choose Member or Business?", answer: "Paid plans are opening soon. Start on Free today. Everything you set up stays with you when you upgrade." },
  { question: "Is there a permanent free plan?", answer: "Yes. Free is a permanent plan for your personal workspace, with no expiry." },
  { question: "Will there be a free trial?", answer: "Yes. When paid plans open, Member and Business will each include a 14 day free trial. One free trial is available per account." },
];
const faqs = [
  { question: "How does the 14 day free trial work?", answer: "Create your account, choose Member or Business and add your card through our secure checkout. Your trial begins when checkout is completed. Your selected subscription starts charging after 14 days unless you cancel before the trial ends. One free trial is available per account." },
  { question: "When will my card be charged?", answer: "For an eligible new trial, your subscription charge is due after the 14 day trial. Checkout shows your plan price and payment schedule before you confirm. Member is US$19 monthly or US$190 yearly. Business is US$39 per user monthly or US$390 per user yearly. The yearly option charges the full annual amount, rather than monthly instalments." },
  { question: "Can I cancel during the trial?", answer: "Yes. Open Billing and subscription, then Manage billing to cancel before your trial ends. You can also update your card and view invoices there." },
  { question: "Is there a permanent free plan?", answer: "Yes. Free is a permanent plan for your personal workspace. You only add a card if you choose to start a Member or Business trial." },
  { question: "Where are my card details stored?", answer: "Stripe handles your card details securely. MemoValet does not store your full card number or security code." },
];

export default function PricingPage() {
  // Read at build, like the rest of the page. Adding the Stripe settings
  // needs a redeploy anyway, and that redeploy turns the trial offer on.
  const paidOpen = billingReady();
  return (
    <MarketingPageShell active="/pricing">
      <div className="memo-pricing">
        <section className="memo-pricing-hero" aria-labelledby="pricing-heading">
          <div className="memo-pricing-orbit" aria-hidden="true" />
          <p className="memo-pricing-eyebrow"><span /> MEMOVALET / PRICING</p>
          <h1 id="pricing-heading">One workspace.<br /><span>A plan for your work.</span></h1>
          <p className="memo-pricing-intro">From personal priorities to your team’s next project.<br className="hidden sm:block" /> Choose a workspace for your information, responsibilities and collaboration.</p>
          <div className="memo-pricing-availability"><span /> {paidOpen ? "Free forever, or try a paid plan free for 14 days" : "Free forever · Paid plans opening soon"}</div>
        </section>

        <PricingPlans paidOpen={paidOpen} />

        <section className="memo-pricing-included" aria-label="Built around your work">
          <p>Less chasing. More doing.</p>
          <div><span><Check size={17} aria-hidden="true" /> Clear decisions</span><span><Check size={17} aria-hidden="true" /> Clear responsibilities</span><span><Check size={17} aria-hidden="true" /> Your work, remembered</span></div>
        </section>

        <section className="memo-pricing-compare" aria-labelledby="comparison-heading">
          <div className="memo-pricing-section-heading"><div><p className="memo-pricing-eyebrow">THE DETAILS, SIMPLY</p><h2 id="comparison-heading">Compare plans for your work.</h2></div><p>Choose the plan that fits the way you work.</p></div>
          <div className="memo-pricing-table-wrap" role="region" aria-label="Compare Free, Member and Business plans" tabIndex={0}>
            <table>
              <caption className="sr-only">{paidOpen ? "Free has no expiry. Member and Business plans include a 14 day free trial." : "Free has no expiry. Member and Business plans are opening soon."}</caption>
              <thead><tr><th scope="col">What’s included</th><th scope="col">Free</th><th scope="col">Member</th><th scope="col">Business</th></tr></thead>
              <tbody>{comparison(paidOpen).map(({ label, values }) => <tr key={label}><th scope="row">{label}</th>{values.map((value, index) => <td key={index}>{value === true ? <><Check size={19} aria-hidden="true" /><span className="sr-only">Included</span></> : value === false ? <><span aria-hidden="true">Not included</span><span className="sr-only">Not included</span></> : value}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="memo-pricing-table-note">{paidOpen ? "Free does not expire. Member and Business trials last 14 days and renew as paid subscriptions unless you cancel." : "Free does not expire. Member and Business are opening soon, each with a 14 day free trial."}</p>
        </section>

        <section className="memo-pricing-faq" aria-labelledby="faq-heading">
          <div><p className="memo-pricing-eyebrow">GOOD TO KNOW</p><h2 id="faq-heading">Your pricing questions,<br />answered.</h2><p>Something else on your mind?<br /><a href="mailto:adrian.kulatunga@gmail.com?subject=MemoValet%20pricing%20question">Let’s talk <ArrowRight size={16} aria-hidden="true" /></a></p></div>
          <div>{(paidOpen ? faqs : faqsBeforeLaunch).map(({ question, answer }) => <details key={question}><summary>{question}<Plus size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className="memo-pricing-bottom" aria-labelledby="pricing-start-heading"><p className="memo-pricing-eyebrow">YOUR NEXT CHAPTER</p><h2 id="pricing-start-heading">Good work starts with a clear next step.</h2><p>Create your account and start organising your work today.</p><Link href="/login?mode=signup" className="memo-pricing-button memo-pricing-button-primary">Get started free <ArrowRight size={18} aria-hidden="true" /></Link></section>
      </div>
    </MarketingPageShell>
  );
}
