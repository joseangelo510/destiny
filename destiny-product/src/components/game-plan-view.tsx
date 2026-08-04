import Link from "next/link";
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
      {plan.needsReview && (
        <section className="game-plan-identity-warning" role="alert">
          <div>
            <span className="eyebrow">Confirm before sharing</span>
            <h2>Destiny found conflicting business details.</h2>
            <p>The website is shown as <strong>{plan.displayName}</strong>. Confirm the business name before exporting this plan so another name can never appear in a client-facing document.</p>
          </div>
          <Link className="secondary-button" href="/onboarding">Confirm business details</Link>
        </section>
      )}

      <header className="game-plan-hero">
        <div>
          <span className="eyebrow">90-day executive plan · {plan.period}</span>
          <h2>{plan.title}</h2>
          <p>{plan.thesis}</p>
          <div className="game-plan-status-row">
            <span>Active quarter</span>
            <span>{plan.taskProgress.complete} of {plan.taskProgress.total} milestones complete</span>
            <span>Updated {lastUpdated}</span>
          </div>
        </div>
        <PrintGamePlanButton disabled={!plan.canExport} />
      </header>

      <section className="game-plan-section game-plan-diagnosis" id="diagnosis">
        <div className="game-plan-section-heading">
          <span>01</span>
          <div><small>Where you are</small><h2>Your starting position</h2><p>A concise baseline from the latest audit. Detailed evidence stays in the supporting report.</p></div>
        </div>
        <div className="game-plan-baseline">
          {plan.baseline.map((metric) => <article key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></article>)}
        </div>
        <Link className="game-plan-text-link" href={auditHref}>Read the full audit →</Link>
      </section>

      <section className="game-plan-section" id="strategy">
        <div className="game-plan-section-heading">
          <span>02</span>
          <div><small>How we win</small><h2>Four focused plays</h2><p>The plan explains why the work matters. Your weekly coach turns these plays into individual tasks.</p></div>
        </div>
        <div className="game-plan-plays">
          {plan.plays.map((play, index) => (
            <article key={play.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{play.title}</h3>
              <p>{play.description}</p>
              <small>{play.evidence}</small>
              <Link href={play.href}>{play.linkLabel} →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="game-plan-section" id="calendar">
        <div className="game-plan-section-heading">
          <span>03</span>
          <div><small>The route</small><h2>Three months at a glance</h2><p>Milestones show the sequence and scope. Exact assignments remain in This Week.</p></div>
        </div>
        <div className="game-plan-months">
          {plan.months.map((month) => (
            <article key={month.label}>
              <div><span>{month.label}</span><small>{month.date}</small></div>
              <h3>{month.theme}</h3>
              <ul>{month.milestones.map((milestone) => <li key={milestone}>{milestone}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="game-plan-section" id="scope">
        <div className="game-plan-section-heading">
          <span>04</span>
          <div><small>The commitment</small><h2>Scope of work</h2><p>Clear boundaries keep the quarter focused and make expectations easier to manage.</p></div>
        </div>
        <div className="game-plan-scope">
          <article><span>In this quarter</span><ul>{plan.scope.inThisQuarter.map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article className="deferred"><span>Not this quarter</span><ul>{plan.scope.outThisQuarter.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
      </section>

      <section className="game-plan-section" id="forecast">
        <div className="game-plan-section-heading">
          <span>05</span>
          <div><small>What to expect</small><h2>Honest forecast ranges</h2><p>Projected work and possible movement are visually separate from verified results in Analytics.</p></div>
        </div>
        <div className="game-plan-forecasts">
          {plan.forecasts.map((forecast) => (
            <article key={forecast.label}>
              <div><span>Projected</span><small>{forecast.label}</small></div>
              <strong>{forecast.expectedRange}</strong>
              <p><b>Baseline</b>{forecast.baseline}</p>
              <p><b>Assumption</b>{forecast.assumption}</p>
              <p><b>Confidence</b>{forecast.confidence}</p>
            </article>
          ))}
        </div>
        <p className="game-plan-disclaimer">{plan.forecastDisclaimer}</p>
      </section>

      <footer className="game-plan-footer">
        <div><strong>How this plan was built</strong><p>Destiny combined onboarding context, the latest website audit, keyword research, and the work currently assigned to this website.</p></div>
        <div><span>Last updated</span><strong>{lastUpdated}</strong></div>
      </footer>
    </article>
  );
}
