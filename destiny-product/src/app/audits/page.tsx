import type { CSSProperties } from "react";
import Link from "next/link";
import { AuditIssueExplorer } from "@/components/audit-issue-explorer";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { buildAuditDashboard, type AuditIssueInput } from "@/lib/seo/audit-dashboard";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

type AuditRow = {
  completed_at: string | null;
  created_at: string;
  failure_message: string | null;
  id: string;
  progress: number;
  provider: string;
  status: string;
};

function sourceLabel(audit: AuditRow) {
  return audit.provider === "dataforseo" ? "Live DataForSEO" : "Demo data";
}

function CompactAuditHistory({ audits }: { audits: AuditRow[] }) {
  return <section className="audit-history-compact">
    <div className="audit-section-heading compact"><div><span className="eyebrow">Previous scans</span><h2>Audit history</h2></div><span>{audits.length} saved</span></div>
    <div className="audit-history-list">{audits.slice(0, 5).map((audit) => <Link href={`/audits/${audit.id}`} key={audit.id}>
      <span className={`status-orb ${audit.status}`} />
      <span><strong>{new Date(audit.created_at).toLocaleDateString()}</strong><small>{sourceLabel(audit)}</small></span>
      <span className={`status-chip ${audit.status === "complete" ? "" : "amber"}`}>{audit.status.replaceAll("_", " ")}</span>
      <b>{audit.progress}%</b><span aria-hidden="true">→</span>
    </Link>)}</div>
  </section>;
}

function CurrentAuditState({ audit }: { audit: AuditRow }) {
  const failed = audit.status === "failed";
  return <section className={`audit-current-state ${failed ? "failed" : "running"}`}>
    <div><span className="eyebrow">{failed ? "Latest scan needs attention" : "New audit in progress"}</span><h2>{failed ? "Destiny could not finish this audit" : `Destiny is checking your website — ${audit.progress}%`}</h2><p>{failed ? audit.failure_message || "The provider did not return enough verified evidence. Your previous completed results remain below." : "You can leave this page. Destiny will save the findings and notify you when the audit is ready."}</p></div>
    {!failed && <div aria-label={`Audit ${audit.progress}% complete`} className="audit-state-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={audit.progress}><span style={{ width: `${audit.progress}%` }} /></div>}
  </section>;
}

export default async function AuditsPage() {
  const { supabase, website } = await getWorkspaceContext();
  const { data } = website
    ? await supabase.from("audits").select("id,status,progress,provider,created_at,completed_at,failure_message").eq("website_id", website.id).order("created_at", { ascending: false }).limit(25)
    : { data: [] };
  const audits = (data ?? []) as AuditRow[];
  const latestAudit = audits[0] ?? null;
  const completedAudit = audits.find((audit) => audit.status === "complete") ?? null;
  const { data: metrics } = completedAudit
    ? await supabase.from("audit_metrics").select("critical_issues,warnings,raw_provider_payload").eq("audit_id", completedAudit.id).maybeSingle()
    : { data: null };

  if (!website) return <WorkspaceShell active="/audits" eyebrow="Destiny workspace" title="Website audits" description="See what is helping or blocking your website from being found."><WorkspaceEmpty title="Complete onboarding first" description="Add your business and website before Destiny can create an audit." /></WorkspaceShell>;
  if (!latestAudit) return <WorkspaceShell active="/audits" eyebrow={website.normalized_domain} title="Website audits" description="See what is helping or blocking your website from being found."><WorkspaceEmpty title="No audits yet" description="Return to the dashboard and start your first website audit." /></WorkspaceShell>;

  if (!completedAudit || !metrics) return <WorkspaceShell active="/audits" eyebrow={website.normalized_domain} title="Website audits" description="See what is helping or blocking your website from being found.">
    <CurrentAuditState audit={latestAudit} /><CompactAuditHistory audits={audits} />
  </WorkspaceShell>;

  const providerResult = providerResultFromMetrics(metrics);
  const providerMetrics = record(providerResult.metrics);
  const issues = list(providerResult.issues).map(record).flatMap((issue) => {
    const severity = issue.severity === "critical" ? "critical" : issue.severity === "warning" ? "warning" : null;
    if (!severity) return [];
    return [{ code: String(issue.code || "unknown_issue"), label: String(issue.label || issue.code || "Technical issue"), severity } satisfies AuditIssueInput];
  });
  const inspectedPages = list(providerResult.pages).length;
  const dashboard = await buildAuditDashboard({
    healthScore: typeof providerMetrics.onPageScore === "number" ? providerMetrics.onPageScore : null,
    inspectedPages,
    inspectedUrl: website.url,
    measuredCritical: Number(metrics.critical_issues ?? 0),
    measuredWarnings: Number(metrics.warnings ?? 0),
    issues,
  });
  const providerNotices = list(providerResult.notices);
  const scoreStyle = { "--audit-score": `${dashboard.healthScore ?? 0}%` } as CSSProperties;
  const scoreLabel = dashboard.healthScore === null ? "Score unavailable" : `${dashboard.healthScore}% initial site health`;

  return <WorkspaceShell active="/audits" eyebrow={website.normalized_domain} title="Website audits" description="Understand your website health, fix the most important technical issues, and verify improvements over time.">
    <FeatureJourneyCallout actionHref="#technical-priority" actionLabel="Review the highest-impact fix" milestone="Get ready to be found" description="Use the latest audit to choose one technical change before exploring the full report." doneLooksLike="The next website fix is chosen and its follow-up task is opened in This Week." evidence="A saved audit with its provider and scan scope shown." />
    {latestAudit.id !== completedAudit.id && <CurrentAuditState audit={latestAudit} />}

    <section className="audit-health-dashboard">
      <div className="audit-score-panel">
        <div aria-label={scoreLabel} aria-valuemax={100} aria-valuemin={0} aria-valuenow={dashboard.healthScore ?? undefined} className={`audit-score-ring ${dashboard.healthScore === null ? "unavailable" : ""}`} role="meter" style={scoreStyle}><div><strong>{dashboard.healthScore ?? "—"}</strong>{dashboard.healthScore !== null && <span>%</span>}</div></div>
        <div className="audit-score-copy"><span className="eyebrow">Latest completed audit</span><h2>{dashboard.healthLabel}</h2><p>{completedAudit.provider === "dataforseo" ? "This is the provider’s on-page score for the homepage checked in this audit. Destiny does not recalculate or inflate it." : "This demonstration score previews how live site health will appear once provider data is connected."}</p><small>{dashboard.coverageLabel} This is not a full-site crawl.</small></div>
      </div>
      <div className="audit-health-summary">
        <article className="critical"><span>Critical</span><strong>{Number(metrics.critical_issues ?? 0)}</strong><p>Can block crawling, understanding, or a reliable visit.</p></article>
        <article className="warning"><span>Warnings</span><strong>{Number(metrics.warnings ?? 0)}</strong><p>Important improvements after the critical work.</p></article>
        <article className="notice"><span>Notices</span><strong>{providerNotices.length}</strong><p>Scope and data notes that keep the report honest.</p></article>
      </div>
      <div className="audit-dashboard-meta"><span><b>{sourceLabel(completedAudit)}</b> · completed {new Date(completedAudit.completed_at ?? completedAudit.created_at).toLocaleString()}</span><div><Link className="secondary-button" href={`/audits/${completedAudit.id}`}>Open saved strategy</Link><Link className="primary-button" href="/this-week">Start the next fix</Link></div></div>
    </section>

    {dashboard.priorityIssue ? <section className="audit-priority-card" id="technical-priority">
      <div className="audit-priority-heading"><span className="eyebrow">Fix these first</span><h2>The changes that will do the most for your technical foundation</h2><p>Destiny ordered these by severity so you know where to begin.</p></div>
      <div className="audit-priority-list">{dashboard.priorityIssues.map((issue, index) => <article key={`${issue.code}-${index}`}><div className="audit-priority-icon">{index + 1}</div><div><h3>{issue.label}</h3><p>{issue.whyItMatters}</p><div className="audit-priority-next"><strong>Next action</strong><span>{issue.nextAction}</span></div></div></article>)}</div>
      <a className="secondary-button" href="#all-technical-issues">View every technical issue</a>
    </section> : <section className="audit-priority-card clear" id="technical-priority"><div className="audit-priority-icon">✓</div><div><span className="eyebrow">No saved technical issues</span><h2>This initial scan did not return a problem to fix</h2><p>Keep monitoring. A deeper crawl can still uncover issues beyond the homepage evidence used here.</p></div></section>}

    <section className="audit-category-overview">
      <div className="audit-section-heading"><div><span className="eyebrow">Where to focus</span><h2>Technical health by category</h2><p>Start with red, then work through amber. A zero means no issue was detected in this scan—not that every page was fully cleared.</p></div></div>
      <div className="audit-category-grid">{dashboard.categories.map((category) => <a href={`#all-technical-issues`} className={category.critical ? "critical" : category.warnings ? "warning" : "clear"} key={category.id}><span className="audit-category-status">{category.critical ? "Critical" : category.warnings ? "Warning" : "No issue detected"}</span><strong>{category.total}</strong><h3>{category.label}</h3><p>{category.description}</p><small>{category.critical} critical · {category.warnings} warnings</small></a>)}</div>
    </section>

    {dashboard.isPartial && <aside className="audit-coverage-warning"><strong>Some measured findings do not have saved row details</strong><p>This older audit measured {dashboard.issueTotal} issues but saved {dashboard.issues.length} issue descriptions. New audits will retain the complete technical list.</p></aside>}
    <AuditIssueExplorer issues={dashboard.issues} />

    <section className="audit-scope-note">
      <div><span className="eyebrow">How to read this report</span><h2>Measured evidence, clearly labeled</h2></div><p>Health and issue counts come from the latest saved provider response. The current fast audit performs technical checks on the homepage and reviews up to {Math.max(inspectedPages, 1)} strategic page{Math.max(inspectedPages, 1) === 1 ? "" : "s"} for business relevance. Full multi-page crawling, Core Web Vitals history, and scheduled comparisons belong to the deeper audit tier.</p>
    </section>
    <CompactAuditHistory audits={audits} />
  </WorkspaceShell>;
}
