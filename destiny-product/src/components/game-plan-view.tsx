import { WorkspaceLink as Link } from "./workspace-link";
import type { GamePlan } from "../lib/product/game-plan";
import { PrintGamePlanButton } from "./print-game-plan-button";

export function GamePlanView({
  auditHref,
  lastUpdated,
  plan,
}: {
  auditHref: string;
  lastUpdated: string;
  plan: GamePlan;
}) {
  return (
    <article className="game-plan-document">
      <nav aria-label="How Rebound SEO coaching sections work" className="game-plan-purpose-nav">
        <span aria-current="page"><strong>Game Plan</strong><small>the why</small></span>
        <Link href="/roadmap"><strong>Roadmap</strong><small>the when</small></Link>
        <Link href="/this-week"><strong>This Week</strong><small>the doing</small></Link>
      </nav>

      <header className="game-plan-hero">
        <div>
          <span className="eyebrow">{plan.domain} · {plan.period}</span>
          <h2 className="game-plan-hero-title">Your 90-day SEO game plan</h2>
          <p>Where you’re starting, the four bets we’re making, and what progress should look like by the end of this quarter.</p>
        </div>
        <div className="game-plan-hero-actions">
          <PrintGamePlanButton displayName={plan.displayName} needsReview={plan.needsReview} />
          <Link className="game-plan-roadmap-link" href="/roadmap">View your roadmap →</Link>
        </div>
      </header>

      <section className="game-plan-section game-plan-diagnosis" id="diagnosis">
        <div className="game-plan-section-heading">
          <span>01</span>
          <div><h2>Where you’re starting</h2><p>{plan.startingLine}</p></div>
        </div>
        <div className="game-plan-baseline">
          {plan.baseline.map((metric) => <article key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></article>)}
        </div>
        <Link className="game-plan-text-link" href={auditHref}>Read the full audit →</Link>
      </section>

      <section className="game-plan-section" id="strategy">
        <div className="game-plan-section-heading">
          <span>02</span>
          <div><h2>The four plays</h2><p>Four bets, chosen from your audit. This is what we’re doing and why it fits your business.</p></div>
        </div>
        <div className="game-plan-plays">
          {plan.plays.map((play, index) => (
            <article key={play.title}>
              <span>{index + 1}</span>
              <div><h3>{play.title}</h3><p>{play.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="game-plan-section" id="calendar">
        <div className="game-plan-section-heading">
          <span>03</span>
          <div><h2>What to expect, month by month</h2><p>SEO compounds slowly at first. That’s normal, and it’s why this plan is honest about the shape of progress.</p></div>
        </div>
        <div className="game-plan-months">
          {plan.months.map((month, index) => (
            <article key={month.label}>
              <div><span>{month.label} · {month.date}</span></div>
              <h3>{month.theme}</h3>
              <p>{month.summary}</p>
              {index === 2 && <strong>Quarter-end direction: {plan.forecasts[0].expectedRange}.</strong>}
            </article>
          ))}
        </div>
        <p className="game-plan-disclaimer">{plan.forecastDisclaimer}</p>
      </section>

      <section className="game-plan-section game-plan-scope-section" id="scope">
        <div className="game-plan-section-heading">
          <span>04</span>
          <div><h2>What this plan does and doesn’t cover</h2></div>
        </div>
        <div className="game-plan-scope">
          <article><span>This quarter covers</span><p>{plan.scope.inThisQuarter.join("; ")}.</p></article>
          <article><span>It won’t do</span><p>{plan.scope.outThisQuarter.join("; ")}.</p></article>
        </div>
      </section>

      <footer className="game-plan-footer">
        <p>Updated {lastUpdated} · {plan.needsReview ? "You’ll confirm your business name before anything is shared" : "Your verified business details will be used when this plan is shared"}</p>
        <PrintGamePlanButton displayName={plan.displayName} needsReview={plan.needsReview} />
      </footer>
    </article>
  );
}
