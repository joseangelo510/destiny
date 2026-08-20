import {
  DEFAULT_ARTICLE_PREFERENCES,
  type GeneratedArticleSource,
} from "./article-generation";
import {
  fitMetaDescription,
  normalizeArticleBody,
  type ArticleDraft,
} from "./article-draft";

export type RepurposeHandoffRow = {
  id?: unknown;
  output_type?: unknown;
  target_keyword?: unknown;
  source_kind?: unknown;
  source_name?: unknown;
  source_url?: unknown;
  status?: unknown;
  draft_title?: unknown;
  draft_body?: unknown;
  draft_metadata?: unknown;
};

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sourcePublisher(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function metaTitle(value: string) {
  if (value.length <= 60) return value;
  const clipped = value.slice(0, 59).replace(/\s+\S*$/, "").replace(/[,:;\s]+$/, "");
  return `${clipped || value.slice(0, 59)}…`;
}

/**
 * Maps a persisted SEO repurpose record into the existing article editor.
 * The draft stays fail-closed: it is editable, but must pass Content Studio's
 * normal evidence and quality generation step before approval or CMS delivery.
 */
export function buildRepurposeArticleDraft(row: RepurposeHandoffRow | null): ArticleDraft | null {
  if (!row || row.output_type !== "seo_blog_article" || row.status !== "ready") return null;

  const title = optionalString(row.draft_title);
  const body = optionalString(row.draft_body);
  const sourceName = optionalString(row.source_name);
  if (!title || !body || !sourceName) return null;

  const keyword = optionalString(row.target_keyword) ?? title.slice(0, 300);
  const sourceUrl = optionalString(row.source_url);
  const metadata = row.draft_metadata && typeof row.draft_metadata === "object" && !Array.isArray(row.draft_metadata)
    ? row.draft_metadata as Record<string, unknown>
    : {};
  const excerpt = optionalString(metadata.excerpt)
    ?? `A repurposed SEO article draft based on ${sourceName}.`;
  const model = optionalString(metadata.model);
  const sources: GeneratedArticleSource[] = sourceUrl
    ? [{
        id: `repurpose-source-${String(row.id ?? "source")}`,
        title: sourceName,
        url: sourceUrl,
        publisher: sourcePublisher(sourceUrl),
      }]
    : [];

  return {
    keyword,
    title,
    metaTitle: metaTitle(title),
    titleCandidates: [],
    metaDescription: fitMetaDescription(excerpt),
    metaDescriptions: [fitMetaDescription(excerpt)],
    body: normalizeArticleBody(body),
    sources,
    infographics: [],
    bucketBrigades: [],
    preferences: { ...DEFAULT_ARTICLE_PREFERENCES },
    generationStatus: "needs_generation",
    generatedBy: model ? `Repurpose · ${model}` : "Repurpose",
    qualityIssues: [{
      code: "generation_required",
      message: "This repurposed draft is editable. Run Content Studio generation to complete its evidence and editorial checks before approval.",
    }],
    optimization: [
      {
        label: "Repurposed source",
        detail: sourceUrl ? `${sourceName} · ${sourceUrl}` : sourceName,
      },
      {
        label: "Approval boundary",
        detail: "Draft only until Content Studio quality checks pass and a person approves it.",
      },
    ],
  };
}