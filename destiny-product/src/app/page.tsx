import type { Metadata } from "next";
import Link from "next/link";
import "./home.css";

const startPath = "/onboarding";
const signInPath = "/login?next=%2Fapp";

export const metadata: Metadata = {
  title: "Destiny — SEO momentum for founders",
  description: "Turn an expert SEO playbook into a focused three-month plan and one clear weekly action.",
};

const categoryTabs = [
  { label: "Research & strategy", active: false },
  { label: "Content creation", active: false },
  { label: "Distribution", active: true },
  { label: "Technical SEO", active: false },
];

const distributionTasks = [
  { title: "Answer the Reddit thread comparing tools in your niche", meta: "r/smallbusiness · 12 min · draft ready for your review" },
  { title: "Reply to the Quora question your customers keep asking", meta: "Quora · 9 min · written in your voice" },
  { title: "Send two review invites to last month’s happiest customers", meta: "Email · 6 min · you approve before anything sends" },
];

const comparisonRows = [
  ["Hands you 40 dashboards and wishes you luck", "Hands you one clear move at a time"],
  ["Generates generic AI content that sounds like everyone", "Writes from your interviews, in your voice"],
  ["Stops at publishing and calls it done", "Distributes where your buyers already ask questions"],
  ["Charges agency prices for reports", "One founding plan a founder can actually justify"],
  ["Assumes you have an SEO team", "Assumes you have twenty minutes"],
];

const howSteps = [
  ["01", "Tell your story", "A guided interview captures your products, customers, competitors, opinions, and proof — the raw material only you have."],
  ["02", "Get your game plan", "Destiny turns your story and live search evidence into a focused three-month strategy with priorities you approve."],
  ["03", "Do this week. Just this week.", "Every Monday you get a small set of moves across the four categories. Finish them, feel the momentum, repeat."],
];

const fundamentals = [
  ["Website audits", "Crawlability, indexing, structure, and performance issues turned into guided fixes."],
  ["Keyword research", "Live demand, intent, difficulty, and rankings — filtered down to what fits your business."],
  ["Content studio", "Briefs, articles, FAQs, and conversion copy drafted from your interviews."],
  ["Weekly plan", "One focused loop that keeps all of it moving without a team."],
];

const extraMile = [
  ["Distribution", "Reddit, Quora, outreach, and social snippets — reviewed by you before anything ships."],
  ["Reviews", "Steady, polite review requests that build local trust on autopilot."],
  ["Backlinks", "Referring domains, anchors, and broken-link opportunities worth your time."],
  ["Rank tracker", "Positions that matter, tracked weekly, explained in plain language."],
  ["LLM visibility", "See how ChatGPT-style assistants describe you — and improve it."],
  ["Connections", "Search Console, Analytics, and Business Profile plugged in with owner approval."],
];

const personas = [
  ["The local expert", "Realtors, clinics, trades. You win on trust — Destiny makes your expertise findable."],
  ["The niche SaaS founder", "You can’t outspend incumbents. You can out-answer them where buyers compare."],
  ["The service studio", "Agencies and consultants whose best marketing is what they know, not what they spend."],
];

const objections = [
  ["“I don’t have time for SEO.”", "You have twenty minutes. That is the entire ask, once a week."],
  ["“I tried tools. They just gave me dashboards.”", "Destiny gives you moves, not metrics. The data stays behind the plan."],
  ["“AI content all sounds the same.”", "Ours starts with an interview. If it doesn’t sound like you, it doesn’t ship."],
  ["“SEO takes forever.”", "Distribution moves — replies, reviews, outreach — start working the first week."],
  ["“I’ll lose control of my brand.”", "Nothing publishes or sends without your approval. Ever."],
];

const outcomes = [
  ["Week 1", "Your audit is done, your keyword strategy is approved, and your first distribution replies are live where buyers are already asking."],
  ["Month 1", "A publishing rhythm in your voice, review momentum, and the first rankings you can point to."],
  ["Month 3", "A finished three-month strategy: compounding content, real backlinks, and a weekly habit you actually kept."],
];

export default function MarketingHome() {
  return (
    <main className="lp">
      <header className="lp-header">
        <Link className="lp-brand" href="/" aria-label="Destiny homepage"><span className="lp-brand-mark">✦</span>Destiny</Link>
        <nav aria-label="Homepage navigation">
          <a href="#how">How it works</a>
          <a href="#toolkit">Toolkit</a>
          <a href="#who">Who it’s for</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="lp-header-actions">
          <Link className="lp-text-link" href={signInPath}>Sign in</Link>
          <Link className="lp-button solid" href={startPath}>Get started</Link>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <p className="lp-kicker">A guided weekly SEO plan for founders</p>
          <h1>Your week of SEO, <em>already planned.</em></h1>
          <p className="lp-lede">Destiny turns an expert playbook into one guided weekly plan — research, content, technical fixes, and the edge most tools skip entirely: distribution where your buyers are already asking.</p>
          <div className="lp-cta-row">
            <Link className="lp-button solid" href={startPath}>Get started</Link>
            <Link className="lp-button outline" href={signInPath}>Sign in</Link>
          </div>
        </div>
        <div className="lp-hero-visual">
          <article className="lp-week-card" aria-label="A Destiny distribution week">
            <div className="lp-week-head"><span className="lp-week-eyebrow">This week</span><strong>Distribution week</strong></div>
            <div className="lp-week-tabs" role="list" aria-label="Weekly plan categories">
              {categoryTabs.map((tab) => <span className={tab.active ? "lp-week-tab active" : "lp-week-tab"} key={tab.label} role="listitem">{tab.label}</span>)}
            </div>
            <div className="lp-week-top-move">
              <small>Top move</small>
              <strong>Reply where your buyers are already asking</strong>
            </div>
            <ul className="lp-week-tasks">
              {distributionTasks.map((task) => <li key={task.title}><span className="lp-task-dot" aria-hidden="true" /><div><strong>{task.title}</strong><small>{task.meta}</small></div></li>)}
            </ul>
            <div className="lp-week-proof" aria-label="Proof bar">
              <span>✓ Every reply approved by you</span>
              <span>✓ Written in your voice</span>
              <span>✓ ~20 minutes total</span>
            </div>
          </article>
        </div>
      </section>

      <section className="lp-section lp-problems" aria-labelledby="problems-title">
        <div className="lp-problems-copy">
          <p className="lp-kicker">The founder’s reality</p>
          <h2 id="problems-title">99 founder problems and SEO ain’t one</h2>
          <p>You are already the support desk, the sales team, the bookkeeper, and the product. Destiny takes the one job that compounds — being found — off your plate and onto a plan.</p>
          <div className="lp-plate" aria-hidden="true">
            <div className="lp-plate-col">
              <small>Your plate today</small>
              <span>Invoices chasing you</span>
              <span>A hiring decision</span>
              <span>Support tickets</span>
              <span>That supplier call</span>
              <span>“Do SEO” — someday</span>
            </div>
            <div className="lp-plate-col lp-plate-plan">
              <small>With Destiny</small>
              <span>Invoices chasing you</span>
              <span>A hiring decision</span>
              <span>Support tickets</span>
              <span>That supplier call</span>
              <span className="lp-plate-done">SEO: this week’s 20 minutes ✓</span>
            </div>
          </div>
        </div>
        <aside className="lp-offplate" aria-label="Off your plate, on your plan">
          <span className="lp-offplate-title">Off your plate · On your plan</span>
          <ul>
            <li><strong>Research</strong><small>done for you, approved by you</small></li>
            <li><strong>Writing</strong><small>drafted from your own words</small></li>
            <li><strong>Distribution</strong><small>queued where buyers ask</small></li>
            <li><strong>Tracking</strong><small>explained, not dashboarded</small></li>
          </ul>
        </aside>
      </section>

      <section className="lp-section lp-compare" aria-labelledby="compare-title">
        <p className="lp-kicker">The honest comparison</p>
        <h2 id="compare-title">Every other tool vs. Destiny</h2>
        <div className="lp-compare-table" role="table" aria-label="Every other tool compared with Destiny">
          <div className="lp-compare-row lp-compare-head" role="row"><span role="columnheader">Every other tool</span><span role="columnheader">Destiny</span></div>
          {comparisonRows.map(([them, us]) => <div className="lp-compare-row" key={us} role="row"><span role="cell">{them}</span><span className="lp-compare-us" role="cell">{us}</span></div>)}
        </div>
      </section>

      <section className="lp-section lp-how" id="how" aria-labelledby="how-title">
        <p className="lp-kicker">How it works</p>
        <h2 id="how-title">Three steps. One habit.</h2>
        <div className="lp-how-grid">
          {howSteps.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <section className="lp-section lp-voice" aria-labelledby="voice-title">
        <div>
          <p className="lp-kicker">The important difference</p>
          <h2 id="voice-title">Most tools produce more content. Destiny produces more of <em>you.</em></h2>
        </div>
        <div className="lp-voice-cards">
          <article><small>Your Voice</small><h3>Interviews in, expertise out</h3><p>Short conversations become pages, articles, and replies built from your real opinions, customer stories, and hard-earned lessons. Automation handles the busywork without erasing the founder.</p></article>
          <article><small>The Habit</small><h3>Twenty minutes that compound</h3><p>One weekly loop across four kinds of work keeps momentum visible. No binge-and-abandon cycles — just a small, finishable week, every week.</p></article>
        </div>
      </section>

      <section className="lp-section lp-toolkit" id="toolkit" aria-labelledby="toolkit-title">
        <p className="lp-kicker">The toolkit</p>
        <h2 id="toolkit-title">The fundamentals, plus the extra mile.</h2>
        <div className="lp-toolkit-group">
          <h3>Fundamentals</h3>
          <div className="lp-toolkit-grid">
            {fundamentals.map(([title, description]) => <article key={title}><h4>{title}</h4><p>{description}</p></article>)}
          </div>
        </div>
        <div className="lp-toolkit-group">
          <h3>The extra mile</h3>
          <div className="lp-toolkit-grid three">
            {extraMile.map(([title, description]) => <article key={title}><h4>{title}</h4><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className="lp-section lp-who" id="who" aria-labelledby="who-title">
        <p className="lp-kicker">Who this is for</p>
        <h2 id="who-title">Built for founders who are the product.</h2>
        <div className="lp-persona-grid">
          {personas.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}
        </div>
        <div className="lp-objections">
          <h3>Five things founders tell us — answered straight.</h3>
          <dl>
            {objections.map(([objection, answer]) => <div key={objection}><dt>{objection}</dt><dd>{answer}</dd></div>)}
          </dl>
        </div>
      </section>

      <section className="lp-section lp-outcomes" aria-labelledby="outcomes-title">
        <p className="lp-kicker">What to expect</p>
        <h2 id="outcomes-title">Momentum you can put a date on.</h2>
        <div className="lp-outcome-grid">
          {outcomes.map(([when, description]) => <article key={when}><span>{when}</span><p>{description}</p></article>)}
        </div>
        <p className="lp-trust" aria-label="Trust">Live SEO analysis connected · Nothing publishes or sends without your approval · Google account and sending integrations require owner authorization.</p>
      </section>

      <section className="lp-pricing" id="pricing" aria-labelledby="pricing-title">
        <div className="lp-pricing-card">
          <small>Founding plan</small>
          <h2 id="pricing-title"><strong>$39.99</strong><span>/month</span></h2>
          <p>A complete weekly workflow for one business, including your first three-month strategy. When you finish it, upgrade to the Growth tier to unlock another three-month planning cycle.</p>
          <Link className="lp-button solid" href={startPath}>Get started</Link>
        </div>
        <div className="lp-closer">
          <h2>Your customers are searching. Your week is planned.</h2>
          <p>Start with the guided interview — twenty minutes from now, Destiny will know your business well enough to plan your first week.</p>
          <div className="lp-cta-row">
            <Link className="lp-button cream" href={startPath}>Get started</Link>
            <Link className="lp-button ghost" href={signInPath}>Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div><Link className="lp-brand" href="/"><span className="lp-brand-mark">✦</span>Destiny</Link><p>Expert SEO, made accessible to founders.</p></div>
        <nav aria-label="Footer navigation">
          <a href="#how">How it works</a>
          <a href="#toolkit">Toolkit</a>
          <a href="#pricing">Pricing</a>
          <Link href={signInPath}>Sign in</Link>
        </nav>
      </footer>
    </main>
  );
}
