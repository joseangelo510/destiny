import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuditMomentumProcessing } from "@/components/audit-momentum-processing";
import { WeeklyTaskList } from "@/components/weekly-task-list";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  buildAuditNarrative,
  buildGuidedFix,
  buildCoachTaskSet,
} from "@/lib/product/coach-experience";
import { resolveBusinessIdentity } from "@/lib/product/game-plan";
import { selectUsableAuditKeywords } from "@/lib/seo/audit-keywords";
import { createClient } from "@/lib/supabase/server";
import { runDestinyServerLogic } from "@/lib/logicaffeine-server";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export default async function AuditResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect(`/login?next=${encodeURIComponent(`/audits/${id}`)}`);

  const [{ data: audit }, { data: metrics }, { data: tasks }] = await Promise.all([
    supabase
      .from("audits")
      .select("id,status,progress,provider,failure_message,created_at,completed_at,website_id,websites(business_name,url,normalized_domain,products_services,problem_solved,ideal_customer,audience_challenges_goals,differentiation)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("audit_metrics").select("*").eq("audit_id", id).maybeSingle(),
    supabase.from("quests").select("*").eq("audit_id", id).order("priority", { ascending: true }).order("created_at", { ascending: true }),
  ]);

  if (!audit) notFound();

  const raw = record(metrics?.raw_provider_payload);
  const emailDelivery = record(raw.emailDelivery);
  const providerResult = record(raw.providerResult);
  const issues = list(providerResult.issues).map(record);
  const competitors = list(providerResult.competitors).map(record);
  const keywords = selectUsableAuditKeywords(providerResult.keywords);
  const relatedWebsite = Array.isArray(audit.websites) ? audit.websites[0] : audit.websites;
  const website = record(relatedWebsite);
  const businessIdentity = await resolveBusinessIdentity({
    businessName: String(website.business_name || ""),
    normalizedDomain: String(website.normalized_domain || website.url || ""),
  });
  const businessName = businessIdentity.displayName;
  if (audit.status !== "complete") {
    const initialPolicy = await runDestinyServerLogic({
      auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0,
      newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
      momentumAuditProgress: Number(audit.progress ?? 0),
      momentumAuditStatusCode: audit.status === "failed" ? 2 : 0,
      // The browser supplies the live elapsed clock immediately after hydration.
      momentumElapsedSeconds: 0,
    });
    return <AuditMomentumProcessing
      auditId={audit.id}
      failureMessage={audit.failure_message}
      initialProgress={Number(audit.progress ?? 0)}
      initialPolicy={initialPolicy}
      initialStatus={audit.status === "failed" ? "failed" : "running"}
      startedAt={audit.created_at}
      website={String(website.normalized_domain || website.url || businessName)}
    />;
  }
  const coach = await buildCoachTaskSet(tasks ?? [], false);
  const coreTasks = coach.window;
  const currentCoachTask = coach.currentTask;
  const primaryTask = coreTasks.find((task) => task.task_type === "primary_quest") ?? coreTasks[1] ?? coreTasks[0];
  const topIssue = [...issues].sort((left, right) => Number(right.severity === "critical") - Number(left.severity === "critical"))[0];
  const narrative = buildAuditNarrative({
    businessName,
    issues,
    primaryTaskTitle: primaryTask?.title,
  });
  const guidedFix = buildGuidedFix(topIssue);
  const taskGroups = coach.groups;
  const remainingTasks = coreTasks.filter((task) => task.status !== "complete").length;
  const sourceLabel = typeof providerResult.sourceLabel === "string"
    ? providerResult.sourceLabel
    : audit.provider === "dataforseo" ? "Live DataForSEO audit" : "Demo audit data";
  const businessUnderstanding = {
    businessName,
    productsServices: String(website.products_services || "Not provided"),
    problemSolved: String(website.problem_solved || "Not provided"),
    idealCustomer: String(website.ideal_customer || "Not provided"),
    audienceGoals: String(website.audience_challenges_goals || "Not provided"),
    differentiation: String(website.differentiation || "Not provided"),
  };

  return <WorkspaceShell active="/results" eyebrow={String(website.normalized_domain || "Destiny workspace")} title="Your SEO strategy is ready" description="Destiny translated your audit results into one clear opportunity and a short strategy checklist. Start at the top; the detailed evidence remains available below.">
      {(emailDelivery.status === "skipped" || emailDelivery.status === "failed") && <div className="integration-banner warning" role="status"><strong>Your results are saved here</strong><p>Destiny could not send the email update for this audit. Use this saved results page and the notification center while email delivery is being connected.</p></div>}
      <section className="audit-narrative">
        <div>
          <span className="eyebrow">{narrative.eyebrow}</span>
          <h2>{narrative.title}</h2>
          <p>{narrative.explanation}</p>
          <a className="primary-button" href="#recommended-fix">{narrative.actionLabel}</a>
        </div>
        <div className={`data-source ${audit.provider === "dataforseo" ? "live" : "demo"}`}><span />{sourceLabel}</div>
      </section>

      <section className="guided-fix-card" id="recommended-fix">
        <div className="guided-fix-heading"><span className="eyebrow">Your first guided step</span><h2>{guidedFix.title}</h2><p>{guidedFix.explanation}</p></div>
        <ol>{guidedFix.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
        <div className="results-actions"><Link className="primary-button" href="/this-week">Start this task</Link><Link className="secondary-button" href="/audits">View audit history</Link></div>
      </section>

      <section className="results-checklist">
        <div className="results-checklist-heading"><div><span className="eyebrow">Your coaching plan</span><h2>See what to do next</h2><p>Destiny completed the research. Work through the checklist in order, one category at a time. Advanced tools appear when they help with the task in front of you.</p></div><Link className="secondary-button" href="/this-week">Open weekly coach</Link></div>
        <div className="coach-category-stack">{taskGroups.map((group, index) => <section className="coach-task-category" id={`results-${group.id}`} key={group.id}><div className="coach-category-heading"><span>{index + 1}</span><div><h3>{group.label}</h3><p>{group.description}</p></div><strong>{group.tasks.filter((task) => task.status === "complete").length} / {group.tasks.length}</strong></div><WeeklyTaskList auditId={id} openTaskId={currentCoachTask?.id ?? null} remainingTasks={remainingTasks} tasks={group.tasks} /></section>)}</div>
      </section>

      <details className="business-context-review">
        <summary><span><strong>Review the business context Destiny used</strong><small>This is optional. Your strategy is already ready.</small></span><b>Review details</b></summary>
        <div className="business-context-body">
          <p>Destiny used your onboarding answers to interpret the search data and tailor this plan. Start a new analysis only if these details need to change.</p>
          <div className="business-understanding-grid">
            <div><span>Business</span><strong>{businessUnderstanding.businessName}</strong></div>
            <div><span>Products and services</span><p>{businessUnderstanding.productsServices}</p></div>
            <div><span>Problem you solve</span><p>{businessUnderstanding.problemSolved}</p></div>
            <div><span>Ideal customer</span><p>{businessUnderstanding.idealCustomer}</p></div>
            <div><span>Audience goals and challenges</span><p>{businessUnderstanding.audienceGoals}</p></div>
            <div className="wide"><span>What makes you stand out</span><p>{businessUnderstanding.differentiation}</p></div>
          </div>
          <Link className="secondary-button" href="/onboarding?new=1">Update these details and run a new analysis</Link>
        </div>
      </details>

      <details className="audit-evidence-drawer" id="technical-evidence">
        <summary><span><strong>Explore the detailed audit evidence</strong><small>Technical findings, keywords, competitors, and measured SEO data</small></span><b>Open results</b></summary>
        <div className="audit-evidence-body">
          <section className="results-metrics">
            {[
              [metrics?.critical_issues ?? 0, "Critical issues"],
              [metrics?.ranking_keywords ?? 0, "Ranking keywords"],
              [metrics?.content_gaps ?? 0, "Content gaps"],
              [Math.round(Number(metrics?.estimated_organic_traffic ?? 0)), "Estimated organic traffic"],
              [metrics?.new_keywords ?? 0, "New keywords"],
              [metrics?.google_reviews ?? 0, "Google reviews"],
            ].map(([value, label]) => <article className="result-stat" key={label}><strong>{Number(value).toLocaleString()}</strong><span>{label}</span></article>)}
          </section>

          <section className="results-grid">
            <article className="result-panel">
              <div className="card-heading"><span>Technical findings</span><small>{issues.length} shown</small></div>
              <div className="result-list">{issues.length ? issues.map((issue, index) => <div key={`${String(issue.code)}-${index}`}><span className={`finding-dot ${issue.severity === "critical" ? "critical" : "warning"}`} /><div><strong>{String(issue.label ?? issue.code)}</strong><small>{String(issue.severity ?? "warning")}</small></div></div>) : <p className="empty-state">No technical findings were saved.</p>}</div>
            </article>
            <article className="result-panel">
              <div className="card-heading"><span>Search competitors</span><small>Shared keyword overlap</small></div>
              <div className="result-list">{competitors.length ? competitors.map((competitor, index) => <div key={`${String(competitor.domain)}-${index}`}><span className="competitor-rank">{index + 1}</span><div><strong>{String(competitor.domain)}</strong><small>{Number(competitor.sharedKeywords ?? 0).toLocaleString()} shared keywords</small></div></div>) : <p className="empty-state">No measured organic competitors were returned.</p>}</div>
            </article>
            <article className="result-panel keyword-strategy-panel">
              <div className="card-heading"><span>Keyword and content strategy</span><small>{keywords.length} usable opportunities</small></div>
              <div className="keyword-preview-list">{keywords.length ? keywords.slice(0, 6).map((keyword, index) => <div key={`${String(keyword.keyword)}-${index}`}><span>{index + 1}</span><div><strong>{String(keyword.keyword)}</strong><small>{String(keyword.opportunity ?? "existing rank").replaceAll("_", " ")} · {Number(keyword.searchVolume ?? 0).toLocaleString()} monthly searches · difficulty {Number(keyword.difficulty ?? 0)}</small></div></div>) : <p className="empty-state">No usable keyword opportunities were saved.</p>}</div>
              <div className="results-actions"><Link className="primary-button" href="/content">Open content studio</Link><Link className="secondary-button" href="/growth-plan">View three-month plan</Link></div>
            </article>
          </section>
        </div>
      </details>

      <footer className="results-footer"><span>Audit ID: {audit.id}</span><span>{audit.completed_at ? `Completed ${new Date(audit.completed_at).toLocaleString()}` : `${audit.progress}% complete`}</span></footer>
  </WorkspaceShell>;
}
