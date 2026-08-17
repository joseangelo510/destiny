import { RankTrackerWorkspace, type RankTrackerKeyword } from "@/components/rank-tracker-workspace";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { StrategyPipelineStrip } from "@/components/strategy-pipeline-strip";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { rankTrackerView } from "@/lib/seo/rank-tracker";
import { rankingEmailCadenceSummary, type RankingDigestFrequency } from "@/lib/notifications/ranking-digest";

export const dynamic = "force-dynamic";

export default async function RankTrackerPage() {
  const context = await getWorkspaceContext();
  if (!context.website) return <WorkspaceShell active="/rank-tracker" eyebrow="Destiny workspace" title="Rank tracker" description="Track the Google positions connected to your approved strategy."><WorkspaceEmpty title="Complete onboarding first" description="Add your website so Destiny knows which domain to measure." /></WorkspaceShell>;

  const [{ data: lists }, { data: tracked }, { data: observations }, { count: approvedCount }, { count: draftCount }, { data: emailPreference }] = await Promise.all([
    context.supabase.from("rank_tracker_lists").select("id,name").eq("website_id", context.website.id).order("name"),
    context.supabase.from("tracked_keywords").select("id,keyword,list_id,status,source,created_at,last_checked_at").eq("website_id", context.website.id).neq("status", "paused").order("created_at"),
    context.supabase.from("rank_observations").select("tracked_keyword_id,observed_at,found,position,result_url").eq("website_id", context.website.id).order("observed_at", { ascending: false }).limit(2000),
    context.supabase.from("keyword_preferences").select("id", { count: "exact", head: true }).eq("website_id", context.website.id).eq("decision", "approved"),
    (context.supabase as unknown as SupabaseClient).from("article_drafts").select("id", { count: "exact", head: true }).eq("website_id", context.website.id),
    context.supabase.from("notification_preferences").select("ranking_digest_frequency,unsubscribed_at").eq("website_id", context.website.id).maybeSingle(),
  ]);
  const emailCadence = rankingEmailCadenceSummary(emailPreference
    ? { frequency: emailPreference.ranking_digest_frequency as RankingDigestFrequency, unsubscribedAt: emailPreference.unsubscribed_at }
    : null);

  const byKeyword = (observations ?? []).reduce<Record<string, typeof observations>>((grouped, observation) => {
    const values = grouped[observation.tracked_keyword_id] ?? [];
    if (values.length < 8) grouped[observation.tracked_keyword_id] = [...values, observation];
    return grouped;
  }, {});
  const rows: RankTrackerKeyword[] = await Promise.all((tracked ?? []).map(async (row) => {
    const history = byKeyword[row.id] ?? [];
    const latest = history[0];
    const previous = history[1];
    const reading = { status: row.status, position: latest?.found ? latest.position : null, found: latest ? latest.found : null };
    const previousReading = previous ? { position: previous.found ? previous.position : null, found: previous.found } : null;
    const policyView = await rankTrackerView(reading, previousReading, { createdAt: row.created_at, lastCheckedAt: row.last_checked_at, now: new Date() });
    return {
      id: row.id,
      keyword: row.keyword,
      listId: row.list_id,
      status: row.status,
      source: row.source,
      createdAt: row.created_at,
      lastCheckedAt: row.last_checked_at,
      currentPosition: latest?.found ? latest.position : null,
      previousPosition: previous?.found ? previous.position : null,
      previousFound: previous ? previous.found : null,
      found: latest ? latest.found : null,
      resultUrl: latest?.result_url ?? null,
      checkedAt: latest?.observed_at ?? null,
      history: history.map((observation) => ({ observedAt: observation.observed_at, position: observation.position, found: observation.found })),
      policyView,
    };
  }));

  return <WorkspaceShell active="/rank-tracker" eyebrow={context.website.normalized_domain} title="Rank tracker" description="Follow the keywords you approved, organize them into lists, and compare evidence-backed Google positions on a consistent weekly cadence.">
    <StrategyPipelineStrip active="rankings" approvedKeywords={approvedCount ?? 0} contentDrafts={draftCount ?? 0} watchedKeywords={(tracked ?? []).filter((row) => row.source !== "strategy").length} />
    <FeatureJourneyCallout actionHref="#rank-tracker-workspace" actionLabel="Track one approved keyword" milestone="Signs it’s working" description="Measure the customer searches your strategy says matter." doneLooksLike="A saved keyword has a fresh observation, or clearly says it is still pending." evidence="Timestamped provider reading, location, device, and result URL." />
    <RankTrackerWorkspace emailCadence={emailCadence} initialKeywords={rows} initialLists={lists ?? []} websiteId={context.website.id} />
  </WorkspaceShell>;
}
