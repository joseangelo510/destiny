import { ArticleReviewWorkspace } from "@/components/article-review-workspace";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import Link from "next/link";
import { buildArticleDraft } from "@/lib/content/article-draft";
import { resolveArticleGenerationCapability } from "@/lib/content/article-generation";
import { buildEditorialCalendar, inferBusinessModel, selectKeywordsForCalendar } from "@/lib/content/editorial-calendar";
import { INITIAL_PLAN_MONTHS, INITIAL_PLAN_WEEKS } from "@/lib/product/plan-horizon";
import { rankKeywordOpportunities } from "@/lib/seo/keyword-opportunity";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";

export default async function ContentPage() {
  const context = await getWorkspaceContext();
  const providerResult = providerResultFromMetrics(context.metrics);
  const pages = list(providerResult.pages).map(record).filter((item) => typeof item.url === "string");
  // Strategic pages only — mirrors the filter on the Keyword strategy page so that
  // incidental city mentions in blog posts or "other"-role pages cannot authorise
  // out-of-market editorial topics via the geo-conflict filter.
  const strategicPages = pages.filter((page) => String(page.role || "other") !== "other" && !/\/(?:blog|news|articles?|category|tag|uncategorized)(?:\/|$)/i.test(String(page.url || "")));
  const pageTextForCalendar = strategicPages.map((page) => String(page.text || "")).join(" ");
  const keywordRecords = list(providerResult.keywords).map(record);
  const rankedKeywords = rankKeywordOpportunities(keywordRecords.flatMap((keyword) => typeof keyword.keyword === "string" ? [{
    keyword: keyword.keyword,
    intent: String(keyword.intent || keyword.providerIntent || "informational"),
    opportunity: String(keyword.opportunity || "site_idea"),
    searchVolume: Number(keyword.searchVolume ?? 0),
    difficulty: Number(keyword.difficulty ?? 0),
    rank: Number(keyword.rank ?? 0),
    cpc: Number(keyword.cpc ?? 0),
    competitorRankers: Number(keyword.competitorRankers ?? 0),
    // Preserve persisted semantic-cluster data so the re-ranking pass can
    // forward it through the fallback path instead of overwriting with
    // "Evidence-based opportunity". Required for offer-fit filtering to
    // distinguish an audience segment from an actual sold service.
    themeId: keyword.themeId,
    themeLabel: keyword.themeLabel,
    themeRole: keyword.themeRole,
  }] : []), {
    productsServices: context.website?.products_services ?? "",
    problemSolved: context.website?.problem_solved ?? "",
    idealCustomer: context.website?.ideal_customer ?? "",
    audienceChallengesGoals: context.website?.audience_challenges_goals ?? "",
    market: context.website?.market ?? "",
    pageText: pageTextForCalendar,
  }, 50);
  const { data: savedKeywordDecisions } = context.audit ? await context.supabase.from("keyword_decisions").select("keyword,decision").eq("audit_id", context.audit.id) : { data: [] };
  const keywordDecisions = Object.fromEntries((savedKeywordDecisions ?? []).map((item) => [item.keyword, item.decision])) as Record<string, "approved" | "declined">;
  const keywords = selectKeywordsForCalendar(rankedKeywords, keywordDecisions, {
    productsServices: context.website?.products_services ?? "",
    locationEvidence: pageTextForCalendar,
    competitorNames: context.competitors.map((competitor) => String(competitor.name || "")).filter(Boolean),
  });
  const calendar = buildEditorialCalendar(keywords.map((keyword) => ({ ...keyword, intent: keyword.providerIntent })), INITIAL_PLAN_WEEKS, inferBusinessModel(context.website?.products_services ?? ""), { productsServices: context.website?.products_services ?? "", pageText: pageTextForCalendar });
  const approvalQuest = context.quests.find((quest) => quest.audit_id === context.audit?.id && quest.task_type === "content_review");
  const articleDrafts = calendar.slice(0, 3).map((item) => buildArticleDraft({
    keyword: item.focusKeyword,
    businessName: context.website?.business_name ?? "Your business",
    problemSolved: context.website?.problem_solved ?? "",
    idealCustomer: context.website?.ideal_customer ?? "",
    differentiation: context.website?.differentiation ?? "",
  }));

  return (
    <WorkspaceShell active="/content" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Content creation" description="Review three editable articles this week, then approve CMS delivery or download Word documents for your team.">
      <FeatureJourneyCallout milestone="Get ready to be found" description="Reviewing and approving a useful article moves your work forward. Destiny separately verifies when search engines begin showing it." />
      {!rankedKeywords.length ? <WorkspaceEmpty title="Keyword strategy is not ready" description="Run an audit to populate the live search-intent opportunity pool." /> : !keywords.length ? <WorkspaceEmpty title="Approve keywords to build the calendar" description="Every reviewed keyword is currently declined. Return to Keyword strategy and approve the searches Destiny should use." /> : (
        <>
        <section className="workspace-card content-workflow"><div><span>1</span><strong>Three outlines ready</strong><small>Built from your keyword strategy</small></div><div className={approvalQuest?.status === "complete" ? "done" : "active"}><span>2</span><strong>Generate, review & approve</strong><small>Research-backed drafts with your direction</small></div><div><span>3</span><strong>Choose delivery</strong><small>CMS connection or editable Word document</small></div><div className="content-workflow-actions"><Link className="secondary-button" href="/integrations">Connect CMS</Link></div></section>
        <ArticleReviewWorkspace
          auditId={context.audit?.id ?? "latest"}
          calendar={calendar}
          calendarSourceLabel={String(providerResult.sourceLabel ?? "Saved audit data")}
          planMonths={INITIAL_PLAN_MONTHS}
          generationCapability={resolveArticleGenerationCapability({
            anthropicApiKey: process.env.ANTHROPIC_API_KEY,
            copyModel: process.env.ANTHROPIC_COPY_MODEL,
          })}
          generationContext={{
            businessName: context.website?.business_name ?? "Your business",
            problemSolved: context.website?.problem_solved ?? "",
            idealCustomer: context.website?.ideal_customer ?? "",
            differentiation: context.website?.differentiation ?? "",
            internalPages: pages.map((page) => ({
              title: String(page.title || page.url),
              url: String(page.url),
              text: typeof page.text === "string" ? page.text : undefined,
            })),
          }}
          initialDrafts={articleDrafts}
          questId={approvalQuest?.id}
          questStatus={approvalQuest?.status}
        />
        </>
      )}
    </WorkspaceShell>
  );
}
