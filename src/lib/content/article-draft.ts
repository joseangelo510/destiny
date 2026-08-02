import {
  DEFAULT_ARTICLE_PREFERENCES,
  type ArticleGenerationPreferences,
  type ArticleQualityIssue,
  type BucketBrigade,
  type GeneratedArticleSource,
  type InfographicSpec,
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
  metaDescription: string;
  metaDescriptions: string[];
  body: string;
  sources: GeneratedArticleSource[];
  infographics: InfographicSpec[];
  bucketBrigades: BucketBrigade[];
  preferences: ArticleGenerationPreferences;
  generationStatus: "starter" | "needs_generation" | "generated";
  generatedBy?: string;
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

export function buildArticleDraft(input: ArticleDraftInput): ArticleDraft {
  const keyword = input.keyword.trim() || "your customer’s search question";
  const titleKeyword = titleCase(keyword);
  const audience = input.idealCustomer.trim() || "the people you serve";
  const problem = input.problemSolved.trim() || "a costly problem they want to solve";
  const difference = (input.differentiation.trim() || "practical experience and a clear point of view").replace(/[.!?]+$/, "");
  const metaDescriptions = [
    fitMetaDescription(`A practical ${keyword} guide for ${audience}, with key questions, tradeoffs, useful proof, and a clear next step.`),
    fitMetaDescription(`Learn how to approach ${keyword} with credible evidence, a worked example, and practical advice for ${audience}.`),
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
      { label: "Starter outline", detail: "Generate the evidence-backed 2,000–3,000-word article before approval." },
      { label: "Focus keyword", detail: `Use “${keyword}” naturally in the title, introduction, and varied subheadings.` },
      { label: "Human proof", detail: "Add one customer example, firsthand lesson, or result before publishing." },
      { label: "Conversion", detail: "End with one clear next step that matches the reader’s intent." },
    ],
  };
}

export function currentArticleQualityIssues(draft: ArticleDraft): ArticleQualityIssue[] {
  if (draft.generationStatus !== "generated") {
    return [{
      code: "generation_required",
      message: draft.generationStatus === "needs_generation"
        ? "The writing preferences changed. Generate the article again before approval."
        : "Generate the full article before approval.",
    }];
  }
  return validateGeneratedArticle({
    title: draft.title,
    metaDescriptions: draft.metaDescriptions,
    bodyMarkdown: draft.body,
    bucketBrigades: draft.bucketBrigades,
    sources: draft.sources,
    infographics: draft.infographics,
  }, draft.keyword, draft.preferences.format);
}

export function articleCanBeApproved(draft: ArticleDraft) {
  return draft.generationStatus === "generated" && currentArticleQualityIssues(draft).length === 0;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function buildWordDocument(draft: ArticleDraft) {
  const paragraphs = escapeHtml(draft.body)
    .split("\n")
    .filter(Boolean)
    .map((line) => line.startsWith("# ") ? `<h1>${line.slice(2)}</h1>`
      : line.startsWith("## ") ? `<h2>${line.slice(3)}</h2>`
      : line.startsWith("### ") ? `<h3>${line.slice(4)}</h3>`
      : `<p>${line}</p>`)
    .join("\n");
  const metaDescriptions = draft.metaDescriptions.map((description, index) => `<p><strong>Meta description ${index + 1}:</strong> ${escapeHtml(description)}</p>`).join("");
  const sources = draft.sources.length ? `<h2>Sources used</h2><ul>${draft.sources.map((source) => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a>${source.publisher ? ` — ${escapeHtml(source.publisher)}` : ""}</li>`).join("")}</ul>` : "";
  const infographics = draft.infographics.length ? `<h2>Original infographic specifications</h2>${draft.infographics.map((graphic) => `<h3>${escapeHtml(graphic.title)}</h3><p>${escapeHtml(graphic.insight)}</p><p><strong>Alt text:</strong> ${escapeHtml(graphic.altText)}</p><p>${escapeHtml(graphic.sourceLabel)}</p>`).join("")}` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="description" content="application-ready Destiny article"><title>${escapeHtml(draft.title)}</title></head><body><p><strong>Focus keyword:</strong> ${escapeHtml(draft.keyword)}</p>${metaDescriptions}${paragraphs}${sources}${infographics}</body></html>`;
}
