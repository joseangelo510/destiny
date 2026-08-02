import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { WeeklyTaskList } from "@/components/weekly-task-list";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { buildAuditNarrative, getCoachTaskWindow } from "@/lib/product/coach-experience";
import { selectUsableAuditKeywords } from "@/lib/seo/audit-keywords";
import { createClient } from "@/lib/supabase/server";

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
  const providerResult = record(raw.providerResult);
  const issues = list(providerResult.issues).map(record);
  const competitors = list(providerResult.competitors).map(record);
  const keywords = selectUsableAuditKeywords(providerResult.keywords);
  const relatedWebsite = Array.isArray(audit.websites) ? audit.websites[0] : audit.websites;
  const website = record(relatedWebsite);
  const businessName = String(website.business_name || website.normalized_domain || "Your business");
  const coreTasks = getCoachTaskWindow(tasks ?? [], false);
  const primaryTask = coreTasks.find((task) => task.task_type === "primary_quest") ?? coreTasks[1] ?? coreTasks[0];
  const narrative = buildAuditNarrative({
    businessName,
    issues,
    primaryTaskTitle: primaryTask?.title,
  });
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

  return <WorkspaceShell active="/results" eyebrow={String(website.normalized_domain || "Destiny workspace")} title={audit.status === "complete" ? "Your results are ready" : audit.status === "failed" ? "Your audit needs attention" : "Destiny is analyzing your website"} description={audit.status === "complete" ? "Destiny translated the audit into one clear opportunity and a short checklist. Start at the top; the detailed evidence remains available below." : `${audit.progress}% complete. Destiny is preparing your evidence and weekly plan.`}>
    {audit.status === "failed" && <div className="error-banner results-error">{audit.failure_message ?? "The audit could not be completed."}</div>}

    {audit.status !== "complete" ? <WorkspaceEmpty title={audit.status === "failed" ? "Review the error and try again" : "Your audit is still running"} description={audit.status === "failed" ? "Return to onboarding to confirm the website and competitor details before starting another audit." : "You can safely leave this page. Destiny will save the completed results and notify you."} /> : <>
      <section className="audit-narrative">
        <div>
          <span className="eyebrow">{narrative.eyebrow}</span>
          <h2>{narrative.title}</h2>
          <p>{narrative.explanation}</p>
          <a className="primary-button" href="#business-understanding">{narrative.actionLabel}</a>
        </div>
        <div className={`data-source ${audit.provider === "dataforseo" ? "live" : "demo"}`}><span />{sourceLabel}</div>
      </section>

      <section className="results-checklist" id="business-understanding">
        <div className="results-checklist-heading"><div><span className="eyebrow">Your first week</span><h2>Start with these three guided tasks</h2><p>First confirm Destiny understands your business. Then complete the most important website action and review the SEO content prepared for you.</p></div><Link className="secondary-button" href="/this-week">Open weekly coach</Link></div>
        <WeeklyTaskList businessUnderstanding={businessUnderstanding} tasks={coreTasks} />
      </section>

      <details className="audit-evidence-drawer">
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
              <div className="results-actions"><Link className="primary-button" href="/content">Open content studio</Link><Link className="secondary-button" href="/growth-plan">View six-month plan</Link></div>
            </article>
          </section>
        </div>
      </details>

      <footer className="results-footer"><span>Audit ID: {audit.id}</span><span>{audit.completed_at ? `Completed ${new Date(audit.completed_at).toLocaleString()}` : `${audit.progress}% complete`}</span></footer>
    </>}
  </WorkspaceShell>;
}
