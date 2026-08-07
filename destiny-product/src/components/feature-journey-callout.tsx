import Link from "next/link";

export function FeatureJourneyCallout({ actionHref, actionLabel, description, doneLooksLike, evidence, milestone }: {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  doneLooksLike?: string;
  evidence?: string;
  milestone: string;
}) {
  return <section className="feature-journey-callout">
    <span aria-hidden="true">⌁</span>
    <div><small>Your guided step</small><strong>{actionLabel ?? `Move toward ${milestone}`}</strong><p>{description}</p>{doneLooksLike && <p className="guided-step-detail"><b>Done looks like:</b> {doneLooksLike}</p>}{evidence && <p className="guided-step-detail"><b>Evidence:</b> {evidence}</p>}</div>
    <div className="feature-journey-actions">{actionHref && <a href={actionHref}>{actionLabel ?? "Start this step"}</a>}<Link href="/roadmap">View roadmap</Link></div>
  </section>;
}
