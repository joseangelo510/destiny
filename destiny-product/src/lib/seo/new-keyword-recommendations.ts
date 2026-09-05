import { themeSeeds, type BusinessSearchBrief } from "../../../supabase/functions/process-audit/business-search-brief";
import { rankKeywordOpportunities, selectDiversifiedKeywordOpportunities, type KeywordBusinessContext } from "./keyword-opportunity";
import type { KeywordResearchRow } from "./research";
import { normalizeTrackedKeyword } from "./rank-tracker";

export type CoveragePage = { url: string; title: string };
export type NewKeywordInput = {
  domain: string;
  business: KeywordBusinessContext;
  brief: BusinessSearchBrief;
  existingKeywords: Array<{ keyword: string; rank: number; url: string }>;
  pages: CoveragePage[];
};
type Research = { rows: KeywordResearchRow[]; updatedAt: string };
export type Coverage = { pages: CoveragePage[]; checkedAt: string };
type Dependencies = {
  research: (seed: string) => Promise<Research>;
  coverage: (keyword: string, domain: string) => Promise<Coverage>;
};
const stopWords = new Set(["a", "an", "the", "for", "of", "in", "to", "and", "with", "your", "how", "what", "is"]);
const tokens = (value: string) => new Set(normalizeTrackedKeyword(value).split(/[^a-z0-9]+/).filter((word) => word && !stopWords.has(word)).map((word) => word.replace(/ies$/, "y").replace(/s$/, "")));

export function topicMatches(keyword: string, text: string) {
  const target = tokens(keyword);
  const other = tokens(text);
  if (target.size < 2) return normalizeTrackedKeyword(keyword) === normalizeTrackedKeyword(text);
  const shared = [...target].filter((word) => other.has(word)).length;
  return shared / target.size >= 0.8;
}

export function newKeywordPageType(keyword: string, intent: string) {
  return /\b(vs|versus|best|alternative|comparison)\b/i.test(keyword) ? "Comparison page"
    : intent === "transactional" ? "Service landing page" : "Blog guide / FAQ";
}

export async function discoverNewKeywordRecommendations(input: NewKeywordInput, deps: Dependencies) {
  const seeds = themeSeeds(input.brief, 6).filter((seed) => seed.length >= 2 && seed.length <= 200);
  const results = await Promise.allSettled(seeds.map((seed) => deps.research(seed)));
  const measured = results.flatMap((result) => result.status === "fulfilled" ? result.value.rows : []);
  const seen = new Set<string>();
  const candidates = measured.flatMap((row) => {
    const normalized = normalizeTrackedKeyword(row.keyword);
    if (!normalized || seen.has(normalized) || !Number.isFinite(row.volume) || row.volume <= 0 || row.position > 0 || row.url) return [];
    seen.add(normalized);
    if (input.existingKeywords.some((known) => topicMatches(row.keyword, known.keyword))
      || input.pages.some((page) => topicMatches(row.keyword, `${page.title} ${new URL(page.url).pathname}`))) return [];
    return [{ keyword: row.keyword, searchVolume: row.volume, difficulty: row.difficulty, cpc: row.cpc, rank: 0, url: "", intent: row.intent, opportunity: "site_idea", competitorRankers: 0 }];
  });
  const ranked = rankKeywordOpportunities(candidates, input.business, 100, input.brief);
  const diverse = selectDiversifiedKeywordOpportunities(ranked, 12).filter((keyword, index, all) => !all.slice(0, index).some((previous) => topicMatches(keyword.keyword, previous.keyword) || topicMatches(previous.keyword, keyword.keyword)));
  const checks = await Promise.allSettled(diverse.map(async (keyword) => {
    const coverage = await deps.coverage(keyword.keyword, input.domain);
    const match = coverage.pages.some((page) => topicMatches(keyword.keyword, `${page.title} ${new URL(page.url).pathname}`));
    return match ? null : { ...keyword, coverageCheckedAt: coverage.checkedAt, coverageDescription: "No matching page found in checked search results", pageType: newKeywordPageType(keyword.keyword, keyword.providerIntent), essential: false };
  }));
  const keywords = checks.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
  const failed = !seeds.length || results.every((result) => result.status === "rejected") || checks.some((result) => result.status === "rejected");
  return { keywords, status: failed ? "unavailable" as const : "ready" as const };
}
