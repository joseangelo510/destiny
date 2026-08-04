import Link from "next/link";

export function FeatureJourneyCallout({ milestone, description }: { milestone: string; description: string }) {
  return <section className="feature-journey-callout">
    <span aria-hidden="true">⌁</span>
    <div><small>Roadmap connection</small><strong>This work moves you toward → {milestone}</strong><p>{description}</p></div>
    <Link href="/roadmap">View roadmap</Link>
  </section>;
}
