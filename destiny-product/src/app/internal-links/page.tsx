import type { SupabaseClient } from "@supabase/supabase-js";
import { InterlinkWorkspace, type InterlinkOpportunityView, type InterlinkRunView } from "@/components/interlink-workspace";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, record } from "@/lib/workspace-context";

export default async function InternalLinksPage() {
  const context = await getWorkspaceContext();
  if (!context.website) return <WorkspaceShell active="/internal-links" eyebrow="Rebound SEO workspace" title="Internal links" description="Find clear opportunities to connect related pages and verify the work live."><WorkspaceEmpty title="Complete onboarding first" description="Add a business and website before Rebound SEO can check internal links." /></WorkspaceShell>;
  if (!context.audit) return <WorkspaceShell active="/internal-links" eyebrow={context.website.normalized_domain} title="Internal links" description="Find clear opportunities to connect related pages and verify the work live."><WorkspaceEmpty title="Complete a website audit first" description="Rebound SEO needs verified website pages before it can recommend safe internal links." /></WorkspaceShell>;
  const db = context.supabase as unknown as SupabaseClient;
  const { data: runRow } = await db.from("interlink_runs").select("id,pages_checked,manifest,completed_at,created_at").eq("website_id", context.website.id).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: opportunityRows } = runRow
    ? await db.from("interlink_opportunities").select("id,source_url,source_title,target_url,target_title,anchor_text,source_sentence,reason,priority_score,priority,status,verified_at,verified_anchor").eq("run_id", runRow.id).order("priority_score", { ascending: false })
    : { data: [] };
  const manifest = record(runRow?.manifest);
  const initialRun: InterlinkRunView | null = runRow ? {
    id: runRow.id,
    pagesChecked: Number(runRow.pages_checked ?? 0),
    inventoryCount: Number(manifest.inventoryCount ?? runRow.pages_checked ?? 0),
    completedAt: String(runRow.completed_at ?? runRow.created_at),
    scope: String(manifest.scope ?? "verified_priority_pages"),
  } : null;
  const initialOpportunities = (opportunityRows ?? []).map((row) => ({
    id: row.id,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title,
    targetUrl: row.target_url,
    targetTitle: row.target_title,
    anchorText: row.anchor_text,
    sourceSentence: row.source_sentence,
    reason: row.reason,
    priority: row.priority,
    score: Number(row.priority_score ?? 0),
    status: row.status,
    verifiedAt: row.verified_at,
    verifiedAnchor: row.verified_anchor,
  })) as InterlinkOpportunityView[];
  return <WorkspaceShell active="/internal-links" eyebrow={context.website.normalized_domain} title="Internal links" description="Find safe opportunities, make one clear edit, and let Rebound SEO verify the live result.">
    <InterlinkWorkspace websiteId={context.website.id} websiteName={context.website.business_name} initialRun={initialRun} initialOpportunities={initialOpportunities} />
  </WorkspaceShell>;
}
