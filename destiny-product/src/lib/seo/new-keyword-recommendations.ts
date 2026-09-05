import { hasContentAngle, orderNewContentTopics, sameContentTopic } from "./new-keyword-order";
import { keywordDiscoverySeeds } from "./keyword-discovery-seeds";
import { type BusinessSearchBrief } from "../../../supabase/functions/process-audit/business-search-brief";
import { rankKeywordOpportunities, type KeywordBusinessContext } from "./keyword-opportunity";
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
  research: (seed: string, options?: { related: boolean; offset: number }) => Promise<Research>;
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

export async function discoverNewKeywordRecommendations(input: NewKeywordInput, dependencies: Dependencies, options: { target?: number; offset?: number } = {}) {
  const target = Math.max(15, Math.min(60, options.target ?? 30));
  const seeds = keywordDiscoverySeeds(input.brief);
  const business = { ...input.business,
    productsServices: [input.business.productsServices, ...input.brief.offerVsEnablement.whatCompanySells].join("; "),
    problemSolved: [input.business.problemSolved, ...input.brief.problems].join("; "),
    idealCustomer: [input.business.idealCustomer, ...input.brief.audiences].join("; "),
    differentiation: [input.business.differentiation, ...input.brief.differentiators].join("; "),
  };
  const seen = new Set<string>();
  const checked = new Set<string>();
  const accepted: Array<ReturnType<typeof rankKeywordOpportunities>[number] & { coverageCheckedAt: string; coverageDescription: string; pageType: string; essential: boolean }> = [];
  let failed = false;
  let successfulResearch = 0;
  let measured = 0;
  // First use phrase suggestions, then related searches to recover different
  // content angles. Coverage rejection never consumes an accepted-result slot.
  for (const related of [false, true]) {
    const rows: KeywordResearchRow[] = [];
    for (let start = 0; start < seeds.length; start += 6) {
      const results = await Promise.allSettled(seeds.slice(start, start + 6).map(seed => dependencies.research(seed, { related, offset: options.offset ?? 0 })));
      for (const result of results) {
        if (result.status === "rejected") { failed = true; continue; }
        successfulResearch++; rows.push(...result.value.rows);
      }
    }
    measured += rows.length;
    const candidates = rows.flatMap(row => {
      const normalized = normalizeTrackedKeyword(row.keyword);
      if (!normalized || seen.has(normalized) || !Number.isFinite(row.volume) || row.volume <= 0 || row.position > 0 || row.url || row.intent === "navigational") return [];
      seen.add(normalized);
      if (input.existingKeywords.some(known => topicMatches(row.keyword, known.keyword)) || input.pages.some(page => topicMatches(row.keyword, `${page.title} ${new URL(page.url).pathname}`))) return [];
      return [{ keyword: row.keyword, searchVolume: row.volume, difficulty: row.difficulty, cpc: row.cpc, rank: 0, url: "", intent: row.intent, opportunity: "site_idea", competitorRankers: 0 }];
    });
    const ranked = rankKeywordOpportunities(candidates, business, candidates.length, input.brief);
    const diverse = orderNewContentTopics(ranked, input.brief).filter(keyword => hasContentAngle(keyword.keyword, input.brief));
    for (let start = 0; start < diverse.length && accepted.length < target && checked.size < 120; start += 6) {
      const batch = diverse.slice(start, start + 6).filter(keyword => !checked.has(keyword.keyword) && !accepted.some(previous => sameContentTopic(keyword.keyword, previous.keyword, input.brief)));
      const checks = await Promise.allSettled(batch.map(async keyword => {
        checked.add(keyword.keyword);
        const coverage = await dependencies.coverage(keyword.keyword, input.domain);
        const match = coverage.pages.some(page => topicMatches(keyword.keyword, `${page.title} ${new URL(page.url).pathname}`));
        return match ? null : { ...keyword, coverageCheckedAt: coverage.checkedAt, coverageDescription: "No matching page found in checked search results", pageType: newKeywordPageType(keyword.keyword, keyword.providerIntent), essential: false };
      }));
      for (const result of checks) {
        if (result.status === "rejected") { failed = true; continue; }
        if (result.value && !accepted.some(previous => sameContentTopic(result.value!.keyword, previous.keyword, input.brief))) accepted.push(result.value);
      }
    }
    if (accepted.length >= target) break;
    if (!successfulResearch) break;
  }
  const keywords = accepted.slice(0, target);
  return { keywords, status: (failed || !seeds.length ? "unavailable" : "ready") as "ready" | "unavailable", diagnostics: { seeds: seeds.length, measured, checked: checked.size, accepted: keywords.length } };
}
