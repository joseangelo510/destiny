import { normalizeTrackedKeyword } from "../seo/rank-tracker";

export type SavedKeywordPreferenceRow = {
  keyword: string;
  normalized_keyword: string;
  decision: string;
  provider_intent?: string | null;
  search_volume?: number | null;
  difficulty?: number | null;
};

export type SavedResearchKeyword = {
  keyword: string;
  intent: string;
  opportunity: "site_idea";
  searchVolume: number;
  difficulty: number;
  providerIntent: string;
  savedFromResearch: true;
};

const PROVIDER_INTENTS = new Set(["transactional", "commercial", "navigational", "informational"]);

/**
 * Research evidence captured when a keyword is approved from Keyword Research.
 * Preserves the live provider values (intent, monthly volume, difficulty) so the
 * saved website preference reflects the report the user acted on, instead of
 * falling back to nulls when the phrase is missing from the audit pool.
 */
export function keywordEvidenceFromResearch(input: unknown): { providerIntent: string | null; searchVolume: number | null; difficulty: number | null } | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = input as { providerIntent?: unknown; searchVolume?: unknown; difficulty?: unknown };
  const providerIntent = typeof candidate.providerIntent === "string" && PROVIDER_INTENTS.has(candidate.providerIntent.toLowerCase())
    ? candidate.providerIntent.toLowerCase()
    : null;
  const volume = Number(candidate.searchVolume);
  const searchVolume = Number.isFinite(volume) && volume >= 0 ? Math.round(volume) : null;
  const rawDifficulty = Number(candidate.difficulty);
  const difficulty = Number.isFinite(rawDifficulty) && rawDifficulty >= 0 && rawDifficulty <= 100 ? Math.round(rawDifficulty) : null;
  return providerIntent === null && searchVolume === null && difficulty === null ? null : { providerIntent, searchVolume, difficulty };
}

/**
 * Merge approved website-level keyword preferences (e.g. saved from later Keyword
 * Research) into the audit-derived keyword pool for the content calendar.
 * - Deduplicates against audit keywords by normalized phrase.
 * - Excludes declined preferences.
 * - Excludes saved phrases without positive monthly search volume.
 */
export function mergeSavedApprovedKeywords<T extends { keyword: string }>(
  auditKeywords: T[],
  preferences: SavedKeywordPreferenceRow[],
): Array<T | SavedResearchKeyword> {
  const seen = new Set(auditKeywords.map((item) => normalizeTrackedKeyword(item.keyword)));
  const merged: Array<T | SavedResearchKeyword> = [...auditKeywords];
  for (const preference of preferences) {
    if (preference.decision !== "approved") continue;
    const normalized = preference.normalized_keyword || normalizeTrackedKeyword(preference.keyword);
    if (!preference.keyword || seen.has(normalized)) continue;
    const searchVolume = Number(preference.search_volume ?? 0);
    if (!Number.isFinite(searchVolume) || searchVolume <= 0) continue;
    const providerIntent = typeof preference.provider_intent === "string" && PROVIDER_INTENTS.has(preference.provider_intent)
      ? preference.provider_intent
      : "informational";
    seen.add(normalized);
    merged.push({
      keyword: preference.keyword,
      intent: providerIntent,
      opportunity: "site_idea",
      searchVolume,
      difficulty: Math.max(0, Math.min(100, Number(preference.difficulty ?? 0))),
      providerIntent,
      savedFromResearch: true,
    });
  }
  return merged;
}
