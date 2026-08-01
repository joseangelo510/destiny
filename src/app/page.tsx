import type { Metadata } from "next";
import Link from "next/link";

const startPath = "/login?next=%2Fapp%3Fstart%3D1";

export const metadata: Metadata = {
  title: "Destiny — SEO momentum for founders",
  description: "Turn an expert SEO playbook into a focused six-month plan and one clear weekly action.",
};

const stages = [
  ["01", "Learn your business", "A guided interview captures your products, customers, competitors, goals, constraints, opinions, and proof."],
  ["02", "Build the plan", "Destiny turns your business inputs and live search evidence into a focused six-month roadmap."],
  ["03", "Create in your voice", "Short interviews become useful pages, articles, FAQs, and conversion copy that sound like you."],
  ["04", "Distribute thoughtfully", "Review Reddit and Quora answers, outreach, review requests, and social snippets before they go live."],
  ["05", "Measure and repeat", "See what is moving, refresh winners, fix issues, and receive the next best action every week."],
];

export default function MarketingHome() {
  return (
    <main className="marketing-shell">
      <header className="marketing-header">
        <Link className="marketing-brand" href="/" aria-label="Destiny homepage"><span>✦</span>Destiny</Link>
        <nav aria-label="Homepage navigation">
          <a href="#how">How it works</a>
          <a href="#proof">Why Destiny</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="marketing-header-actions">
          <a className="marketing-text-link" href="#product-preview">Open demo</a>
          <Link className="marketing-button purple" href={startPath}>Analyze a website</Link>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <p className="marketing-kicker">The SEO operating system for founders</p>
          <h1>Get found online, <em>20 minutes</em> at a time.</h1>
          <p className="marketing-lede">Destiny turns an expert SEO playbook into a focused six-month plan, founder-led content, thoughtful distribution, and a weekly habit you can actually keep.</p>
          <div className="marketing-cta-row">
            <Link className="marketing-button gold" href={startPath}>Analyze my website</Link>
            <Link className="marketing-button outline" href="/login?next=%2Fapp">Open my dashboard <span aria-hidden="true">→</span></Link>
          </div>
          <div className="marketing-trust-row" aria-label="Product promises">
            <span>✓ No setup required</span>
            <span>✓ Your voice, not generic AI</span>
            <span>✓ Every action stays under your control</span>
          </div>
        </div>

        <div className="marketing-product-wrap" id="product-preview">
          <div className="marketing-glow" />
          <article className="marketing-product-card" aria-label="Destiny product preview">
            <div className="preview-browser-bar"><span /><span /><span /><small>mayatorresrealty.com</small></div>
            <div className="preview-metric-row">
              <div><small>Organic traffic</small><strong>2,840</strong><em>▲ 18% this month</em></div>
              <div className="preview-ring"><span>8w</span></div>
            </div>
            <div className="preview-progress"><span /></div>
            <div className="preview-quest">
              <small>Your next best move · 8 min</small>
              <h2>Share what San Francisco home listings never explain.</h2>
              <Link href={startPath}>Start agent interview</Link>
            </div>
            <div className="preview-win">🎉 “san francisco homebuyer agent” gained 18 positions in the demo scenario.</div>
          </article>
        </div>
      </section>

      <section className="marketing-section marketing-how" id="how">
        <p className="marketing-kicker">One system · five repeating stages</p>
        <h2>Everything an agency would manage. Broken into moves a founder can finish.</h2>
        <div className="marketing-stage-grid">
          {stages.map(([number, title, description]) => (
            <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>
          ))}
        </div>
      </section>

      <section className="marketing-proof" id="proof">
        <div>
          <p className="marketing-kicker">The important difference</p>
          <h2>Most tools produce more content. Destiny produces more of <em>you.</em></h2>
          <p>Your useful opinions, hard-earned lessons, customer stories, and real language become the raw material. Automation handles the busywork without erasing the founder.</p>
        </div>
        <div className="voice-comparison">
          <article className="generic-voice"><small>Generic AI</small><p>Work with a knowledgeable real-estate agent who understands the local market and can help you find the right home.</p></article>
          <article className="destiny-voice"><small>Destiny · Maya’s voice</small><p>“A San Francisco home is more than square footage. The block, the light, the inspection, and the life your family will build there can change the entire decision.”</p><span>Agent interview · client-informed</span></article>
        </div>
      </section>

      <section className="marketing-pricing" id="pricing">
        <div><small>Founding plan</small><strong>$39.99<span>/month</span></strong></div>
        <p>A complete weekly workflow for one business. Start with a live website audit, then build search visibility one focused action at a time.</p>
        <Link className="marketing-button gold" href={startPath}>Claim your destiny</Link>
      </section>

      <footer className="marketing-footer">
        <div><Link className="marketing-brand" href="/"><span>✦</span>Destiny</Link><p>Expert SEO, made accessible to founders.</p></div>
        <p>Live SEO analysis connected · Google account and sending integrations require owner authorization.</p>
      </footer>
    </main>
  );
}
