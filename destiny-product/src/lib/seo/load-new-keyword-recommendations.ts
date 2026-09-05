import { recoverDiscoveryPool, retainDiscoveryOrder } from "./keyword-discovery-recovery";
import "server-only";
import { unstable_cache } from "next/cache";
import { deterministicBusinessSearchBrief, type BusinessSearchBrief } from "../../../supabase/functions/process-audit/business-search-brief";
import { getResearchClient } from "./research";
import { checkKeywordCoverage } from "./keyword-coverage";
import { applyKeywordPreferenceSignals, type KeywordPreferenceSignal } from "./keyword-opportunity";
import { discoverNewKeywordRecommendations, type NewKeywordInput } from "./new-keyword-recommendations";
import { getWorkspaceContext, list, record, providerResultFromMetrics } from "../workspace-context";

type ResearchResult = Awaited<ReturnType<typeof discoverNewKeywordRecommendations>>;
const cachedSeed = unstable_cache(async (query: string, related: boolean, offset: number) => getResearchClient().keywordResearch({ query, mode: "keyword", related, offset }), ["keyword-discovery-seed-v2"], { revalidate: 86400 });
const cachedCoverage = unstable_cache(checkKeywordCoverage, ["keyword-discovery-coverage-v2"], { revalidate: 86400 });
// Each continuation appends a fresh provider page to the same site-scoped pool.
// Earlier accepted rows retain their order, and decisions remain outside cache.
const cachedResearch = unstable_cache(async (websiteId: string, auditId: string, input: NewKeywordInput, round: number): Promise<ResearchResult> => {
  const previous = round > 0 ? await cachedResearch(websiteId, auditId, input, round - 1) : null;
  const result = await discoverNewKeywordRecommendations({ ...input, existingKeywords: [...input.existingKeywords, ...(previous?.keywords ?? []).map(keyword => ({ keyword: keyword.keyword, rank: 0, url: "" }))] }, {
    research: (query, options) => cachedSeed(query, options?.related ?? false, options?.offset ?? 0),
    coverage: cachedCoverage,
  }, { offset: round * 100, target: round ? 15 : 30 });
  if (result.status === "unavailable" && !result.keywords.length) throw new Error("New keyword research is unavailable.");
  return { ...result, keywords: [...(previous?.keywords ?? []), ...result.keywords] };
}, ["new-keyword-recommendations-v2"], { revalidate: 86400 });

export async function loadNewKeywordRecommendations(context: Awaited<ReturnType<typeof getWorkspaceContext>>, round = 0) {
  if (!context.website || !context.audit) return { keywords: [], status: "unavailable" as const };
  const website = context.website;
  const provider = providerResultFromMetrics(context.metrics);
  const business = { businessName: website.business_name ?? "", productsServices: website.products_services ?? "", idealCustomer: website.ideal_customer ?? "", problemSolved: website.problem_solved ?? "", audienceChallengesGoals: website.audience_challenges_goals ?? "", differentiation: website.differentiation ?? "", market: website.market ?? "" };
  const savedBrief = record(provider.businessSearchBrief);
  const brief = Array.isArray(savedBrief.themes) && savedBrief.themes.length
    ? savedBrief as unknown as BusinessSearchBrief : deterministicBusinessSearchBrief(business);
  try {
    const result = await recoverDiscoveryPool((currentRound) => cachedResearch(website.id, context.audit.id, {
      domain: website.url, business, brief,
      existingKeywords: list(provider.keywords).map(record).map((keyword) => ({ keyword: String(keyword.keyword ?? ""), rank: Number(keyword.rank ?? 0), url: String(keyword.url ?? "") })),
      pages: list(provider.pages).map(record).flatMap((page) => typeof page.url === "string" && /^https?:\/\//.test(page.url) ? [{ url: page.url, title: String(page.title || String(page.text ?? "").split("\n")[0]) }] : []),
    }, currentRound), Math.max(0, Math.min(5, Math.floor(round))));
    const { data: preferences, error } = await context.supabase.from("keyword_preferences").select("normalized_keyword,decision,reason,updated_at").eq("website_id", website.id);
    if (error) throw new Error("Saved keyword feedback could not be checked.");
    const signals = (preferences ?? []).map((item) => ({ normalizedKeyword: item.normalized_keyword, decision: item.decision, reason: item.reason, updatedAt: item.updated_at })) as KeywordPreferenceSignal[];
    return { ...result, keywords: retainDiscoveryOrder(result.keywords, applyKeywordPreferenceSignals(result.keywords, signals)) };
  } catch {
    return { keywords: [], status: "unavailable" as const };
  }
}
