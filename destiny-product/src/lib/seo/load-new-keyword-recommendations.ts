import "server-only";
import { unstable_cache } from "next/cache";
import { deterministicBusinessSearchBrief, type BusinessSearchBrief } from "../../../supabase/functions/process-audit/business-search-brief";
import { getResearchClient } from "./research";
import { checkKeywordCoverage } from "./keyword-coverage";
import { applyKeywordPreferenceSignals, type KeywordPreferenceSignal } from "./keyword-opportunity";
import { discoverNewKeywordRecommendations, type NewKeywordInput } from "./new-keyword-recommendations";
import { getWorkspaceContext, list, record, providerResultFromMetrics } from "../workspace-context";

// All arguments, including the website, audit and business context, form the cache key.
// No auth client or cookies enter this cache. Current decisions are applied afterward.
const cachedResearch = unstable_cache(async (_websiteId: string, _auditId: string, input: NewKeywordInput) => {
  const client = getResearchClient();
  const result = await discoverNewKeywordRecommendations(input, {
    research: (query) => client.keywordResearch({ query, mode: "keyword" }),
    coverage: checkKeywordCoverage,
  });
  if (result.status === "unavailable" && !result.keywords.length) throw new Error("New keyword research is unavailable.");
  return result;
}, ["new-keyword-recommendations-v1"], { revalidate: 86400 });

export async function loadNewKeywordRecommendations(context: Awaited<ReturnType<typeof getWorkspaceContext>>) {
  if (!context.website || !context.audit) return { keywords: [], status: "unavailable" as const };
  const website = context.website;
  const provider = providerResultFromMetrics(context.metrics);
  const business = { businessName: website.business_name ?? "", productsServices: website.products_services ?? "", idealCustomer: website.ideal_customer ?? "", problemSolved: website.problem_solved ?? "", audienceChallengesGoals: website.audience_challenges_goals ?? "", differentiation: website.differentiation ?? "", market: website.market ?? "" };
  const savedBrief = record(provider.businessSearchBrief);
  const brief = Array.isArray(savedBrief.themes) && savedBrief.themes.length
    ? savedBrief as unknown as BusinessSearchBrief : deterministicBusinessSearchBrief(business);
  try {
    const result = await cachedResearch(website.id, context.audit.id, {
      domain: website.url, business, brief,
      existingKeywords: list(provider.keywords).map(record).map((keyword) => ({ keyword: String(keyword.keyword ?? ""), rank: Number(keyword.rank ?? 0), url: String(keyword.url ?? "") })),
      pages: list(provider.pages).map(record).flatMap((page) => typeof page.url === "string" && /^https?:\/\//.test(page.url) ? [{ url: page.url, title: String(page.title ?? "") }] : []),
    });
    const { data: preferences, error } = await context.supabase.from("keyword_preferences").select("normalized_keyword,decision,reason,updated_at").eq("website_id", website.id);
    if (error) throw new Error("Saved keyword feedback could not be checked.");
    const signals = (preferences ?? []).map((item) => ({ normalizedKeyword: item.normalized_keyword, decision: item.decision, reason: item.reason, updatedAt: item.updated_at })) as KeywordPreferenceSignal[];
    return { ...result, keywords: applyKeywordPreferenceSignals(result.keywords, signals) };
  } catch {
    return { keywords: [], status: "unavailable" as const };
  }
}
