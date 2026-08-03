import Link from "next/link";
import { CelebrationControls } from "./celebration-controls";
import type { buildSeoRoadmap, SeoRoadmapNode } from "../lib/product/roadmap";
import type { buildWeeklyProgressSummary } from "../lib/quests/streak";

type RoadmapExperienceProps = {
  roadmap: ReturnType<typeof buildSeoRoadmap>;
  weekly: ReturnType<typeof buildWeeklyProgressSummary>;
};

const DESTINATIONS = [
  {
    id: "ready",
    timing: "First 60 days",
    title: "Get ready to be found",
    description: "Strengthen your website and publish useful content.",
    nodeIds: ["foundations", "content-published", "pages-indexed"],
  },
  {
    id: "visibility",
    timing: "Days 61–120",
    title: "Build visibility",
    description: "Help more of the right people discover and visit you.",
    nodeIds: ["first-impressions", "first-clicks", "page-two"],
  },
  {
    id: "growth",
    timing: "Days 121–180",
    title: "Grow what works",
    description: "Build on the search activity that produces real customer actions.",
    nodeIds: ["page-one", "first-organic-lead", "compounding-authority"],
  },
] as const;

function destinationFor(node: SeoRoadmapNode | null) {
  const index = DESTINATIONS.findIndex((destination) => node && destination.nodeIds.includes(node.id as never));
  return index === -1 ? DESTINATIONS.length - 1 : index;
}

export function RoadmapExperience({ roadmap, weekly }: RoadmapExperienceProps) {
  const currentDestination = destinationFor(roadmap.currentNode);
  const weekNumber = Math.max(1, weekly.lifetimeActiveWeeks + 1);
  const markerPosition = Math.max(7, Math.min(93, 7 + roadmap.progress * .86));
  const nextAction = roadmap.currentNode ?? {
    actionHref: "/this-week",
    actionLabel: "Open this week",
    label: "Keep building what works",
    description: "Your current landmarks are complete. Destiny will keep watching connected results while you continue the weekly loop.",
  };

  return <>
    <section className="apple-roadmap" aria-labelledby="apple-roadmap-title">
      <div className="apple-roadmap-copy">
        <span className="eyebrow">Your visibility journey · Week {weekNumber}</span>
        <h2 id="apple-roadmap-title">A clear path to being found.</h2>
        <p>Three destinations. One useful step at a time.</p>
      </div>

      <div className="apple-roadmap-map" aria-label={`${roadmap.progress}% of your visibility journey complete`}>
        <svg className="apple-roadmap-route" viewBox="0 0 100 18" role="img" aria-label="Your progress along the visibility journey" preserveAspectRatio="none">
          <path className="apple-roadmap-route-base" d="M7 10 C25 1, 36 17, 50 10 S76 2, 93 10" pathLength="100" />
          <path className="apple-roadmap-route-progress" d="M7 10 C25 1, 36 17, 50 10 S76 2, 93 10" pathLength="100" style={{ strokeDasharray: `${roadmap.progress} 100` }} />
          <circle className="apple-roadmap-marker-halo" cx={markerPosition} cy="10" r="4.2" />
          <circle className="apple-roadmap-marker" cx={markerPosition} cy="10" r="2.1" />
        </svg>
        <div className="apple-roadmap-position" style={{ left: `${markerPosition}%` }}><span>You are here</span></div>

        <div className="apple-roadmap-destinations">
          {DESTINATIONS.map((destination, index) => {
            const destinationNodes = roadmap.nodes.filter((node) => destination.nodeIds.includes(node.id as never));
            const complete = destinationNodes.every((node) => node.state === "complete");
            const current = index === currentDestination && !complete;
            return <article className={`${complete ? "complete" : ""} ${current ? "current" : ""}`} key={destination.id}>
              <span className="apple-roadmap-stop" aria-hidden="true">{complete ? "✓" : index + 1}</span>
              <small>{destination.timing}</small>
              <h3>{destination.title}</h3>
              <p>{destination.description}</p>
            </article>;
          })}
        </div>
      </div>

      <div className="apple-roadmap-next">
        <div>
          <span>Your next step</span>
          <h3>{nextAction.label}</h3>
          <p>{nextAction.description}</p>
        </div>
        <Link className="primary-button" href={nextAction.actionHref}>{nextAction.actionLabel}</Link>
      </div>

      <div className="apple-roadmap-legend" aria-label="Progress key">
        <span><i className="effort" /> <strong>Your steps</strong> — work you complete</span>
        <span><i className="outcome" /> <strong>Signs it’s working</strong> — results Destiny verifies</span>
      </div>
    </section>

    <details className="roadmap-explanation apple-roadmap-details">
      <summary><span><strong>How progress works</strong><small>Destiny keeps your actions separate from verified results</small></span><b>View details</b></summary>
      <div className="roadmap-truth-key">
        <div><span className="effort-dot" /><strong>Your steps</strong><p>These move forward when you finish useful work, such as fixing a page or publishing content.</p></div>
        <div><span className="outcome-dot" /><strong>Signs it’s working</strong><p>These move forward only when connected search or analytics data confirms a real result.</p></div>
      </div>
    </details>

    <details className="roadmap-explanation apple-roadmap-details">
      <summary><span><strong>What Destiny is watching</strong><small>{roadmap.completedCount} of {roadmap.nodes.length} signals complete</small></span><b>View signals</b></summary>
      <div className="apple-roadmap-evidence-list">
        {roadmap.nodes.map((node) => <article key={node.id} className={node.state}>
          <span aria-hidden="true">{node.state === "complete" ? "✓" : node.state === "current" ? "→" : "·"}</span>
          <div><strong>{node.label}</strong><p>{node.evidence}</p></div>
          <small>{node.kind === "effort" ? "Your step" : "Verified result"}</small>
        </article>)}
      </div>
    </details>

    <details className="roadmap-momentum-drawer">
      <summary><span><strong>Your momentum history</strong><small>{weekly.currentStreak}-week streak · {weekly.perfectWeeks} Perfect Weeks</small></span><b>View history</b></summary>
      <section className="roadmap-momentum-grid" aria-label="Weekly momentum">
        {[
          [weekly.currentStreak, "Current streak", "Consecutive active weeks"],
          [weekly.bestStreak, "Best streak", "Longest saved weekly run"],
          [weekly.perfectWeeks, "Perfect Weeks", "Every assigned task completed"],
          [weekly.lifetimeActiveWeeks, "Lifetime active weeks", "Weeks with completed work"],
        ].map(([value, label, detail]) => <article key={String(label)}><strong>{Number(value)}</strong><span>{label}</span><small>{detail}</small></article>)}
      </section>
    </details>

    <CelebrationControls />
  </>;
}
