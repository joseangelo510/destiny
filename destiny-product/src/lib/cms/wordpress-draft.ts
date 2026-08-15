import { renderArticleMarkdownToHtml } from "@/lib/content/article-draft";
import { articleTitleQualityIssues, renderInfographicSvg, type InfographicSpec } from "@/lib/content/article-generation";

export type WordPressDraftRequest = {
  websiteId?: unknown;
  auditId?: unknown;
  keyword?: unknown;
  title?: unknown;
  metaTitle?: unknown;
  titleCandidates?: unknown;
  body?: unknown;
  metaDescription?: unknown;
  infographics?: unknown;
  approved?: unknown;
  generationStatus?: unknown;
};

function prepareInfographics(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ name: string; svg: string; alt: string }>;
  return value.slice(0, 3).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const graphic = entry as Partial<InfographicSpec>;
    if (typeof graphic.title !== "string" || !graphic.title.trim() || typeof graphic.altText !== "string" || !graphic.altText.trim()) return [];
    if (typeof graphic.insight !== "string" || !Array.isArray(graphic.items) || typeof graphic.sourceLabel !== "string") return [];
    const spec: InfographicSpec = {
      id: typeof graphic.id === "string" && graphic.id.trim() ? graphic.id.trim() : `graphic-${index + 1}`,
      template: graphic.template === "comparison" || graphic.template === "stat" || graphic.template === "timeline" || graphic.template === "checklist" ? graphic.template : "steps",
      title: graphic.title.trim(),
      insight: graphic.insight.trim(),
      items: graphic.items.filter((item): item is string => typeof item === "string").slice(0, 8),
      sourceLabel: graphic.sourceLabel.trim(),
      altText: graphic.altText.trim(),
    };
    return [{ name: spec.id.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLocaleLowerCase() || `graphic-${index + 1}`, svg: renderInfographicSvg(spec), alt: spec.altText }];
  });
}

export function prepareWordPressDraft(input: WordPressDraftRequest) {
  if (typeof input.websiteId !== "string" || !input.websiteId.trim()) {
    throw new Error("Complete onboarding before sending an article to WordPress.");
  }
  if (input.approved !== true || input.generationStatus !== "generated") {
    throw new Error("Approve the completed article before sending it to WordPress.");
  }

  const auditId = typeof input.auditId === "string" ? input.auditId.trim() : "";
  const keyword = typeof input.keyword === "string" ? input.keyword.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const metaTitle = typeof input.metaTitle === "string" && input.metaTitle.trim() ? input.metaTitle.trim().slice(0, 160) : title;
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const excerpt = typeof input.metaDescription === "string" ? input.metaDescription.trim().slice(0, 280) : "";
  if (!auditId || !keyword || !title || body.length < 100) {
    throw new Error("The approved article is incomplete. Review it before sending it to WordPress.");
  }
  const titleIssues = articleTitleQualityIssues({ title, metaTitle, titleCandidates: input.titleCandidates, bodyMarkdown: body }, keyword);
  if (titleIssues.length) throw new Error(`Review the headline and SEO/meta title before sending this article: ${titleIssues[0].message}`);

  const contentHtml = renderArticleMarkdownToHtml(body).replace(/^<h1>.*?<\/h1>/, "");
  if (!contentHtml) throw new Error("The approved article has no content to send.");

  return {
    websiteId: input.websiteId.trim(),
    articleKey: `${auditId}:${keyword}`.slice(0, 500),
    title,
    metaTitle,
    contentHtml,
    excerpt,
    graphics: prepareInfographics(input.infographics),
  };
}
