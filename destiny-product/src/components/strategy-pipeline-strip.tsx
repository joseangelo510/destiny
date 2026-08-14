import { WorkspaceLink } from "./workspace-link";

const steps = [
  { id: "keywords", label: "Plan keywords", href: "/keywords" },
  { id: "content", label: "Content", href: "/content" },
  { id: "rankings", label: "Rankings", href: "/rank-tracker" },
] as const;

export function StrategyPipelineStrip({ active, approvedKeywords, contentDrafts, watchedKeywords }: {
  active: "keywords" | "content" | "rankings";
  approvedKeywords: number;
  contentDrafts: number;
  watchedKeywords: number;
}) {
  const counts = { keywords: `${approvedKeywords} approved`, content: `${contentDrafts} drafts`, rankings: `${watchedKeywords} watched` };
  return <section aria-label="How keyword planning, content, and rank tracking work together" className="strategy-pipeline-strip">
    <div><strong>Your SEO workflow</strong><p>Approved keywords build your plan, guide content, and enter rank tracking automatically. Manually added searches stay in your Watchlist.</p></div>
    <nav>{steps.map((step, index) => <WorkspaceLink aria-current={active === step.id ? "step" : undefined} className={active === step.id ? "active" : ""} href={step.href} key={step.id}><span>{index + 1}</span><span><strong>{step.label}</strong><small>{counts[step.id]}</small></span>{index < steps.length - 1 ? <b aria-hidden="true">→</b> : null}</WorkspaceLink>)}</nav>
  </section>;
}
