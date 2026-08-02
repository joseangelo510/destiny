import Link from "next/link";
import { CelebrationControls } from "@/components/celebration-controls";
import { CompassCompanion } from "@/components/compass-companion";
import type { buildSeoRoadmap } from "@/lib/product/roadmap";
import type { buildWeeklyProgressSummary } from "@/lib/quests/streak";

type RoadmapExperienceProps = {
  roadmap: ReturnType<typeof buildSeoRoadmap>;
  weekly: ReturnType<typeof buildWeeklyProgressSummary>;
};

export function RoadmapExperience({ roadmap, weekly }: RoadmapExperienceProps) {
  return <>
    <section className="roadmap-hero">
      <CompassCompanion completed={roadmap.completedCount} total={roadmap.nodes.length} />
      <div className="roadmap-hero-copy"><span className="eyebrow">{roadmap.progress}% of the route verified or completed</span><h2>{roadmap.currentNode ? `Next landmark: ${roadmap.currentNode.label}` : "Every current landmark is complete"}</h2><p>{roadmap.currentNode?.description ?? "Destiny will keep monitoring connected data for the next useful growth loop."}</p>{roadmap.currentNode && <Link className="primary-button" href={roadmap.currentNode.actionHref}>{roadmap.currentNode.actionLabel}</Link>}</div>
      <div className="roadmap-truth-key"><div><span className="effort-dot" /><strong>Effort node</strong><p>Unlocks when you complete the work. It may be self-reported until verification is available.</p></div><div><span className="outcome-dot" /><strong>Outcome node</strong><p>Unlocks only from connected Search Console or Analytics evidence.</p></div></div>
    </section>

    <section className="roadmap-momentum-grid" aria-label="Weekly momentum">
      {[
        [weekly.currentStreak, "Current streak", "Consecutive active weeks"],
        [weekly.bestStreak, "Best streak", "Longest saved weekly run"],
        [weekly.perfectWeeks, "Perfect Weeks", "Every assigned task completed"],
        [weekly.lifetimeActiveWeeks, "Lifetime active weeks", "Weeks with completed work"],
      ].map(([value, label, detail]) => <article key={String(label)}><strong>{Number(value)}</strong><span>{label}</span><small>{detail}</small></article>)}
    </section>

    <section className="seo-treasure-map" aria-label="SEO journey landmarks">
      <div className="treasure-route" />
      {roadmap.nodes.map((node, index) => <article className={`roadmap-node ${node.state} ${node.kind} ${index % 2 ? "right" : "left"}`} key={node.id}>
        <div className="roadmap-node-marker"><span>{node.state === "complete" ? "✓" : node.state === "current" ? "⌁" : ""}</span></div>
        <div className="roadmap-node-card">
          <div className="roadmap-node-topline"><span>{node.kind === "effort" ? "Effort node" : "Verified outcome"}</span><b>{node.state === "complete" ? "Unlocked" : node.state === "current" ? "Current landmark" : "Covered by fog"}</b></div>
          <h2>{node.label}</h2>
          <p>{node.description}</p>
          <small>{node.typicalRange}</small>
          <div className="roadmap-evidence"><strong>{node.state === "complete" ? "Evidence" : "What unlocks it"}</strong><span>{node.evidence}</span></div>
          {node.state === "current" && <Link href={node.actionHref}>{node.actionLabel} →</Link>}
        </div>
      </article>)}
    </section>

    <CelebrationControls />
  </>;
}
