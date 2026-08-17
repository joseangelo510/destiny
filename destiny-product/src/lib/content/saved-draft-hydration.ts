import { normalizeArticleBody, type ArticleDraft } from "./article-draft";
import { markdownWordCount } from "./article-generation";

export type HydratedArticleDraft = ArticleDraft & { approved: boolean; failureReason?: string };

/**
 * Saved browser drafts are convenience state, never proof that a generated
 * article is complete. Only restore the review surface for a full,
 * quality-passing generation; otherwise restore the brief and allow retry.
 */
export function normalizeSavedArticleDraft(value: unknown, fallback: ArticleDraft): HydratedArticleDraft {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<HydratedArticleDraft> : {};
  const savedBody = typeof saved.body === "string" ? saved.body : "";
  const preferences = { ...fallback.preferences, ...(saved.preferences ?? {}) };
  const hasGenerationProvenance = typeof saved.generatedBy === "string"
    && saved.generatedBy.trim().length > 0
    && savedBody.trim().length > 0;
  const passedQualityAtGeneration = Array.isArray(saved.qualityIssues) && saved.qualityIssues.length === 0;
  const hasSufficientWords = markdownWordCount(savedBody) >= (preferences.format === "seo_article" ? 1800 : 600);
  const generationStatus = (saved.generationStatus === "generated" || saved.generationStatus === "needs_generation")
    && hasGenerationProvenance
    && passedQualityAtGeneration
    && hasSufficientWords
    ? saved.generationStatus
    : "starter";

  if (generationStatus === "starter") {
    return {
      ...fallback,
      keyword: typeof saved.keyword === "string" && saved.keyword.trim().length > 0 ? saved.keyword : fallback.keyword,
      preferences,
      generationStatus,
      approved: false,
      failureReason: typeof saved.failureReason === "string" ? saved.failureReason : undefined,
    };
  }

  const metaDescriptions = Array.isArray(saved.metaDescriptions) && saved.metaDescriptions.length
    ? saved.metaDescriptions.filter((item): item is string => typeof item === "string").slice(0, 1)
    : fallback.metaDescriptions;
  return {
    ...fallback,
    ...saved,
    metaTitle: typeof saved.metaTitle === "string" && saved.metaTitle.trim() ? saved.metaTitle : typeof saved.title === "string" ? saved.title : fallback.metaTitle,
    titleCandidates: Array.isArray(saved.titleCandidates) ? saved.titleCandidates : fallback.titleCandidates,
    metaDescription: metaDescriptions[0] ?? fallback.metaDescription,
    metaDescriptions,
    body: normalizeArticleBody(savedBody),
    sources: Array.isArray(saved.sources) ? saved.sources : fallback.sources,
    infographics: Array.isArray(saved.infographics) ? saved.infographics : fallback.infographics,
    bucketBrigades: Array.isArray(saved.bucketBrigades) ? saved.bucketBrigades : fallback.bucketBrigades,
    preferences,
    generationStatus,
    qualityIssues: Array.isArray(saved.qualityIssues) ? saved.qualityIssues : fallback.qualityIssues,
    approved: saved.approved === true && generationStatus === "generated",
    failureReason: typeof saved.failureReason === "string" ? saved.failureReason : undefined,
  };
}
