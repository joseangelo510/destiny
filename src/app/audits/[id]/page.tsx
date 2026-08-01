import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QuestCompletion } from "@/components/quest-completion";
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

  const [{ data: audit }, { data: metrics }, { data: quest }] = await Promise.all([
    supabase
      .from("audits")
      .select("id,status,progress,provider,failure_message,created_at,completed_at,website_id,websites(business_name,url,normalized_domain)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("audit_metrics").select("*").eq("audit_id", id).maybeSingle(),
    supabase.from("quests").select("id,title,description,category,status,xp,due_at").eq("audit_id", id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  if (!audit) notFound();

  const raw = record(metrics?.raw_provider_payload);
  const providerResult = record(raw.providerResult);
  const issues = list(providerResult.issues).map(record);
  const competitors = list(providerResult.competitors).map(record);
  const keywords = list(providerResult.keywords).map(record).filter((item) => typeof item.keyword === "string");
  const website = Array.isArray(audit.websites) ? audit.websites[0] : audit.websites;
  const sourceLabel = typeof providerResult.sourceLabel === "string"
    ? providerResult.sourceLabel
    : audit.provider === "dataforseo" ? "Live DataForSEO audit" : "Demo audit data";

  return (
    <main className="results-shell">
      <header className="results-topbar">
        <Link className="brand" href="/app"><span className="brand-mark">D</span><span>Destiny</span></Link>
        <Link className="secondary-button results-back" href="/app">← Back to dashboard</Link>
      </header>

      <section className="results-hero">
        <div>
          <div className="eyebrow">Saved audit results</div>
          <h1>{audit.status === "complete" ? "Your audit is ready." : audit.status === "failed" ? "Your audit needs attention." : "Your audit is running."}</h1>
          <p>{website?.business_name ?? website?.normalized_domain ?? "Your website"} · {website?.normalized_domain}</p>
        </div>
        <div className={`data-source ${audit.provider === "dataforseo" ? "live" : "demo"}`}><span />{sourceLabel}</div>
      </section>

      {audit.status === "failed" && <div className="error-banner results-error">{audit.failure_message ?? "The audit could not be completed."}</div>}

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
        <article className="result-panel next-action-panel">
          <div className="eyebrow">LOGOS next action</div>
          <h2>{quest?.title ?? "Your first quest will appear when the audit completes."}</h2>
          <p>{quest?.description ?? "Destiny is still preparing your recommendation."}</p>
          {quest && <div className="quest-details"><span>{quest.category}</span><span>+{quest.xp} XP</span><span>{quest.status.replaceAll("_", " ")}</span></div>}
          {quest && <QuestCompletion questId={quest.id} status={quest.status} xp={quest.xp} />}
        </article>

        <article className="result-panel">
          <div className="card-heading"><span>Technical findings</span><small>{issues.length} shown</small></div>
          <div className="result-list">
            {issues.length ? issues.map((issue, index) => (
              <div key={`${String(issue.code)}-${index}`}><span className={`finding-dot ${issue.severity === "critical" ? "critical" : "warning"}`} /><div><strong>{String(issue.label ?? issue.code)}</strong><small>{String(issue.severity ?? "warning")}</small></div></div>
            )) : <p className="empty-state">No technical findings have been saved yet.</p>}
          </div>
        </article>

        <article className="result-panel">
          <div className="card-heading"><span>Search competitors</span><small>Shared keyword overlap</small></div>
          <div className="result-list">
            {competitors.length ? competitors.map((competitor, index) => (
              <div key={`${String(competitor.domain)}-${index}`}><span className="competitor-rank">{index + 1}</span><div><strong>{String(competitor.domain)}</strong><small>{Number(competitor.sharedKeywords ?? 0).toLocaleString()} shared keywords</small></div></div>
            )) : <p className="empty-state">Competitor results will appear after the audit completes.</p>}
          </div>
        </article>

        <article className="result-panel keyword-strategy-panel">
          <div className="card-heading"><span>Keyword and content strategy</span><small>{keywords.length} weekly topics saved</small></div>
          <div className="keyword-preview-list">
            {keywords.length ? keywords.slice(0, 6).map((keyword, index) => {
              const opportunity = String(keyword.opportunity ?? "existing_rank");
              const label = opportunity === "competitor_gap" ? "Competitor gap" : opportunity === "site_idea" ? "Relevant idea" : `Current rank ${Number(keyword.rank ?? 0) || "—"}`;
              return <div key={`${String(keyword.keyword)}-${index}`}><span>{index + 1}</span><div><strong>{String(keyword.keyword)}</strong><small>{label} · {Number(keyword.searchVolume ?? 0).toLocaleString()} monthly searches · difficulty {Number(keyword.difficulty ?? 0)}</small></div></div>;
            }) : <p className="empty-state">Keyword opportunities will appear after the audit completes.</p>}
          </div>
          <div className="results-actions"><Link className="primary-button" href="/content">View six-month editorial calendar</Link><Link className="secondary-button" href="/growth-plan">View weekly growth plan</Link></div>
        </article>
      </section>

      <footer className="results-footer">
        <span>Audit ID: {audit.id}</span>
        <span>{audit.completed_at ? `Completed ${new Date(audit.completed_at).toLocaleString()}` : `${audit.progress}% complete`}</span>
      </footer>
    </main>
  );
}
