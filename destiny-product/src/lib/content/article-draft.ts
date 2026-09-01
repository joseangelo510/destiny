import {
  DEFAULT_ARTICLE_PREFERENCES,
  type ArticleGenerationPreferences,
  type ArticleInternalPage,
  type ArticleQualityIssue,
  type ArticleTitleCandidate,
  type BucketBrigade,
  type GeneratedArticleSource,
  type InfographicSpec,
  markdownWordCount,
  validateGeneratedArticle,
} from "./article-generation";

export type ArticleDraftInput = {
  keyword: string;
  businessName: string;
  problemSolved: string;
  idealCustomer: string;
  differentiation: string;
};

export type ArticleDraft = {
  keyword: string;
  title: string;
  metaTitle: string;
  titleCandidates: ArticleTitleCandidate[];
  metaDescription: string;
  metaDescriptions: string[];
  body: string;
  sources: GeneratedArticleSource[];
  infographics: InfographicSpec[];
  bucketBrigades: BucketBrigade[];
  preferences: ArticleGenerationPreferences;
  generationStatus: "starter" | "needs_generation" | "generated";
  generatedBy?: string;
  verifiedInternalPages?: ArticleInternalPage[];
  qualityIssues: ArticleQualityIssue[];
  optimization: Array<{ label: string; detail: string }>;
};

function titleCase(value: string) {
  const brandTerms: Record<string, string> = {
    ai: "AI",
    b2b: "B2B",
    b2c: "B2C",
    cms: "CMS",
    crm: "CRM",
    saas: "SaaS",
    seo: "SEO",
  };
  return value.split(/(\s+)/).map((word) => {
    const normalized = word.toLocaleLowerCase();
    if (brandTerms[normalized]) return brandTerms[normalized];
    return word.replace(/^\w/, (character) => character.toUpperCase());
  }).join("");
}

export function fitMetaDescription(value: string) {
  if (value.length <= 150) return value;
  const clipped = value.slice(0, 149).replace(/\s+\S*$/, "").replace(/[,:;\s]+$/, "");
  return `${clipped}…`;
}

export function normalizeArticleBody(value: string) {
  return value.replace(/\.{2,}(\s+That matters\b)/g, ".$1");
}

export function mergePersistedArticleDrafts(fallbacks: ArticleDraft[], saved: unknown): ArticleDraft[] {
  if (!Array.isArray(saved)) return fallbacks;
  const byKeyword = new Map(saved.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const keyword = (value as Partial<ArticleDraft>).keyword;
    return typeof keyword === "string" ? [[keyword, value as Partial<ArticleDraft>] as const] : [];
  }));

  return fallbacks.map((fallback) => {
    const candidate = byKeyword.get(fallback.keyword);
    const generationStatus = candidate?.generationStatus;
    if (!candidate
      || (generationStatus !== "starter" && generationStatus !== "needs_generation" && generationStatus !== "generated")
      || typeof candidate.title !== "string"
      || typeof candidate.body !== "string") return fallback;
    // Replit hardening: approval stays fail-closed without hiding real work.
    // A saved article always keeps its content on reload; but it may only claim
    // "generated" status when it has provenance, enough depth, and is not
    // incomplete — otherwise it is demoted to needs_generation so it cannot be
    // approved until regenerated. QA warnings (e.g. heading structure) do not
    // hide the article: currentArticleQualityIssues blocks approval client-side.
    let safeStatus = generationStatus;
    if (generationStatus === "generated") {
      const savedFormat = (candidate.preferences ?? fallback.preferences).format ?? fallback.preferences.format;
      const hasGenerationProvenance = typeof candidate.generatedBy === "string" && candidate.generatedBy.trim().length > 0 && candidate.body.trim().length > 0;
      const hasSufficientWords = markdownWordCount(candidate.body) >= (savedFormat === "seo_article" ? 1800 : 600);
      const isIncomplete = Array.isArray(candidate.qualityIssues)
        && candidate.qualityIssues.some((issue) => issue?.code === "incomplete_output" || issue?.code === "generation_required");
      if (!hasGenerationProvenance || !hasSufficientWords || isIncomplete) safeStatus = "needs_generation";
    }
    const metaDescriptions = Array.isArray(candidate.metaDescriptions)
      ? candidate.metaDescriptions.filter((item): item is string => typeof item === "string").slice(0, 1).map(fitMetaDescription)
      : fallback.metaDescriptions;
    return {
      ...fallback,
      ...candidate,
      keyword: fallback.keyword,
      metaTitle: typeof candidate.metaTitle === "string" && candidate.metaTitle.trim() ? candidate.metaTitle : candidate.title,
      titleCandidates: Array.isArray(candidate.titleCandidates) ? candidate.titleCandidates : fallback.titleCandidates,
      metaDescription: metaDescriptions[0] ?? fallback.metaDescription,
      metaDescriptions,
      body: normalizeArticleBody(candidate.body),
      sources: Array.isArray(candidate.sources) ? candidate.sources : fallback.sources,
      infographics: Array.isArray(candidate.infographics) ? candidate.infographics : fallback.infographics,
      bucketBrigades: Array.isArray(candidate.bucketBrigades) ? candidate.bucketBrigades : fallback.bucketBrigades,
      preferences: { ...fallback.preferences, ...(candidate.preferences ?? {}) },
      qualityIssues: Array.isArray(candidate.qualityIssues) ? candidate.qualityIssues : fallback.qualityIssues,
      optimization: Array.isArray(candidate.optimization) ? candidate.optimization : fallback.optimization,
      generationStatus: safeStatus,
    };
  });
}

export function buildPersistedArticleDraftSeeds(
  fallbacks: ArticleDraft[],
  saved: unknown,
  context: Omit<ArticleDraftInput, "keyword">,
  limit = 3,
) {
  const fallbackByKeyword = new Map(fallbacks.map((draft) => [draft.keyword.trim().toLocaleLowerCase("en-US"), draft]));
  const savedKeywords = Array.isArray(saved) ? saved.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const keyword = (value as Partial<ArticleDraft>).keyword;
    return typeof keyword === "string" && keyword.trim() ? [keyword.trim()] : [];
  }) : [];
  const orderedKeywords = [...savedKeywords, ...fallbacks.map((draft) => draft.keyword)];
  const seen = new Set<string>();
  return orderedKeywords.flatMap((keyword) => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("en-US");
    if (!normalizedKeyword || seen.has(normalizedKeyword)) return [];
    seen.add(normalizedKeyword);
    return [fallbackByKeyword.get(normalizedKeyword) ?? buildArticleDraft({ ...context, keyword })];
  }).slice(0, Math.max(0, limit));
}

export function buildArticleDraft(input: ArticleDraftInput): ArticleDraft {
  const keyword = input.keyword.trim() || "your customer’s search question";
  const titleKeyword = titleCase(keyword);
  const audience = input.idealCustomer.trim() || "the people you serve";
  const problem = input.problemSolved.trim() || "a costly problem they want to solve";
  const difference = (input.differentiation.trim() || "practical experience and a clear point of view").replace(/[.!?]+$/, "");
  const metaDescriptions = [
    fitMetaDescription(`A practical ${keyword} guide for ${audience}, with key questions, tradeoffs, useful proof, and a clear next step.`),
  ];
  const body = `# ${titleKeyword}: A Practical Guide

When ${audience} search for ${keyword}, they are rarely looking for more generic information. They are trying to make a confident decision, avoid an expensive mistake, or understand what a useful next step looks like.

${input.businessName} approaches that decision from a practical starting point: ${problem}

## What should someone understand first?

Start by defining the outcome you actually need. A useful ${keyword} decision should connect the work to a real customer, business, or operational result. It should also make the tradeoffs clear: what requires time, what requires expertise, and what can be measured after implementation.

## The questions worth asking

1. What specific problem should this solve?
2. Who needs to be involved before a decision is made?
3. What proof shows that the approach works?
4. What should improve in the first 30, 60, and 90 days?
5. How will the result be measured and revisited?

## What makes a strong approach different?

${difference}. That matters because good work should reflect the real language, constraints, and goals of the business instead of repeating advice that could apply to anyone.

## A practical next step

Write down the outcome you want, the evidence you already have, and the obstacle that is slowing progress. Use those three inputs to evaluate the next ${keyword} recommendation. If the recommendation cannot explain how it connects to those facts, it probably needs more work.

## Frequently asked questions

### How quickly should results appear?

The timeline depends on the starting point and the size of the change. The first useful milestone is usually a clear baseline and a completed action that can be measured again.

### What should I measure?

Track the metrics closest to the intended outcome. For search work, that can include rankings, qualified organic traffic, conversions, and the pages or sources that influence a customer’s decision.

### What should I do next?

Review this draft for accuracy, add a real example from your experience, and replace any statement that does not sound like your voice. Then approve it for your CMS or download the editable document for your team.`;
  return {
    keyword,
    title: `${titleKeyword}: A Practical Guide`,
    metaTitle: `${titleKeyword}: A Practical Guide`,
    titleCandidates: [],
    metaDescription: metaDescriptions[0],
    metaDescriptions,
    body: normalizeArticleBody(body),
    sources: [],
    infographics: [],
    bucketBrigades: [],
    preferences: { ...DEFAULT_ARTICLE_PREFERENCES },
    generationStatus: "starter",
    qualityIssues: [{ code: "generation_required", message: "This is a starter outline. Generate the full SEO article before approval." }],
    optimization: [
      { label: "Starter outline", detail: "Generate the evidence-backed 2,000–2,200-word article before approval." },
      { label: "Focus keyword", detail: `Use “${keyword}” naturally in the title, introduction, and varied subheadings.` },
      { label: "Human proof", detail: "Add one customer example, firsthand lesson, or result before publishing." },
      { label: "Conversion", detail: "End with one clear next step that matches the reader’s intent." },
    ],
  };
}

export async function currentArticleQualityIssues(draft: ArticleDraft): Promise<ArticleQualityIssue[]> {
  if (draft.generationStatus !== "generated") {
    return [{
      code: "generation_required",
      message: draft.generationStatus === "needs_generation"
        ? "The writing preferences changed. Generate the article again before approval."
        : "Generate the full article before approval.",
    }];
  }
  return await validateGeneratedArticle({
    title: draft.title,
    metaTitle: draft.metaTitle,
    titleCandidates: draft.titleCandidates,
    metaDescriptions: draft.metaDescriptions,
    bodyMarkdown: draft.body,
    bucketBrigades: draft.bucketBrigades,
    sources: draft.sources,
    infographics: draft.infographics,
  }, draft.keyword, draft.preferences.format, draft.verifiedInternalPages ?? []);
}

export async function articleCanBeApproved(draft: ArticleDraft) {
  return draft.generationStatus === "generated" && (await currentArticleQualityIssues(draft)).length === 0;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value: string) {
  const links: string[] = [];
  const withLinkTokens = value.replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/gi, (_match, label: string, url: string) => {
    const token = `DESTINYWORDLINK${links.length}TOKEN`;
    const linkedLabel = escapeHtml(label)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>");
    links.push(`<a href="${escapeHtmlAttribute(url)}">${linkedLabel}</a>`);
    return token;
  });

  let rendered = escapeHtml(withLinkTokens)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Allow italic spans inside bold text, e.g. **change *when* and *how***.
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,!?;:)]|$)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,!?;:)]|$)/g, "$1<em>$2</em>");

  links.forEach((link, index) => {
    rendered = rendered.replace(`DESTINYWORDLINK${index}TOKEN`, link);
  });
  return rendered;
}

export function renderArticleMarkdownToHtml(markdown: string) {
  const blocks: string[] = [];
  const paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join(" ")}</p>`);
    paragraph.length = 0;
  };
  const closeList = () => {
    if (!listType) return;
    blocks.push(`</${listType}>`);
    listType = null;
  };
  const openList = (type: "ul" | "ol") => {
    flushParagraph();
    if (listType === type) return;
    closeList();
    blocks.push(`<${type}>`);
    listType = type;
  };

  markdown.replace(/\r\n?/g, "\n").split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      return;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const unorderedItem = /^[-+*]\s+(.+)$/.exec(line);
    if (unorderedItem) {
      openList("ul");
      blocks.push(`<li>${renderInlineMarkdown(unorderedItem[1])}</li>`);
      return;
    }

    const orderedItem = /^\d+[.)]\s+(.+)$/.exec(line);
    if (orderedItem) {
      openList("ol");
      blocks.push(`<li>${renderInlineMarkdown(orderedItem[1])}</li>`);
      return;
    }

    const quote = /^>\s?(.+)$/.exec(line);
    if (quote) {
      flushParagraph();
      closeList();
      blocks.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      return;
    }

    if (/^([-*_])\1{2,}$/.test(line)) {
      flushParagraph();
      closeList();
      blocks.push("<hr>");
      return;
    }

    closeList();
    paragraph.push(line);
  });

  flushParagraph();
  closeList();
  return blocks.join("");
}

export function buildWordDocument(draft: ArticleDraft) {
  const paragraphs = renderArticleMarkdownToHtml(draft.body);
  const titleMetadata = `<p><strong>Article headline:</strong> ${escapeHtml(draft.title)}</p><p><strong>SEO/meta title:</strong> ${escapeHtml(draft.metaTitle)}</p>`;
  const metaDescriptions = draft.metaDescriptions.map((description, index) => `<p><strong>Meta description ${index + 1}:</strong> ${escapeHtml(description)}</p>`).join("");
  const sources = draft.sources.length ? `<h2>Sources used</h2><ul>${draft.sources.map((source) => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a>${source.publisher ? ` — ${escapeHtml(source.publisher)}` : ""}</li>`).join("")}</ul>` : "";
  const infographics = draft.infographics.length ? `<h2>Original infographic specifications</h2>${draft.infographics.map((graphic) => `<h3>${escapeHtml(graphic.title)}</h3><p>${escapeHtml(graphic.insight)}</p><p><strong>Alt text:</strong> ${escapeHtml(graphic.altText)}</p><p>${escapeHtml(graphic.sourceLabel)}</p>`).join("")}` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="description" content="application-ready Rebound SEO article"><title>${escapeHtml(draft.metaTitle)}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#1f342d;line-height:1.6;max-width:760px;margin:40px auto}h1{font-size:30px;line-height:1.2;margin:28px 0 14px}h2{font-size:23px;line-height:1.3;margin:26px 0 10px}h3{font-size:19px;line-height:1.35;margin:22px 0 8px}h4,h5,h6{font-size:16px;margin:20px 0 8px}p{margin:0 0 14px}ul,ol{margin:0 0 16px;padding-left:28px}li{margin:0 0 7px}blockquote{border-left:4px solid #8fc5b0;margin:18px 0;padding:8px 18px;color:#48645a}a{color:#176b51;text-decoration:underline}code{background:#f1f5f3;padding:1px 4px}</style></head><body><p><strong>Focus keyword:</strong> ${escapeHtml(draft.keyword)}</p>${titleMetadata}${metaDescriptions}${paragraphs}${sources}${infographics}</body></html>`;
}
