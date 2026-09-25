import { WorkspaceLink as Link } from "./workspace-link";

export function FeatureJourneyCallout({ actionHref, actionLabel, complete = false, description, doneLooksLike, evidence, milestone }: {
  actionHref?: string;
  actionLabel?: string;
  complete?: boolean;
  description: string;
  doneLooksLike?: string;
  evidence?: string;
  milestone: string;
}) {
  return <section className="feature-journey-callout" data-complete={complete || undefined}>
    <span aria-hidden="true">{complete ? "✓" : "⌁"}</span>
    <div><small>{complete ? "Guided step complete" : "Your guided step"}</small><strong>{actionLabel ?? `Move toward ${milestone}`}</strong><p>{description}</p>{doneLooksLike && <p className="guided-step-detail"><b>Done looks like:</b> {doneLooksLike}</p>}{evidence && <p className="guided-step-detail"><b>Evidence:</b> {evidence}</p>}</div>
    <div className="feature-journey-actions">{actionHref && <Link href={actionHref}>{actionLabel ?? "Start this step"}</Link>}<Link href="/roadmap">View roadmap</Link></div>
  </section>;
}
