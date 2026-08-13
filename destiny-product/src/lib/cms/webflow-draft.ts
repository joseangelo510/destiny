import { renderArticleMarkdownToHtml } from "@/lib/content/article-draft";
import { markdownWordCount, renderInfographicSvg, type InfographicSpec } from "@/lib/content/article-generation";

export type WebflowDraftRequest = {
  websiteId?: unknown;
  auditId?: unknown;
  keyword?: unknown;
  title?: unknown;
  body?: unknown;
  metaDescription?: unknown;
  infographics?: unknown;
  approved?: unknown;
  generationStatus?: unknown;
};

function prepareInfographics(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ name: string; svg: string; alt: string }>;
  const graphics: Array<{ name: string; svg: string; alt: string }> = [];
  for (const entry of value.slice(0, 3)) {
    if (!entry || typeof entry !== "object") continue;
    const spec = entry as Partial<InfographicSpec>;
    if (typeof spec.title !== "string" || !spec.title || typeof spec.altText !== "string" || !spec.altText) continue;
    if (typeof spec.insight !== "string" || !Array.isArray(spec.items) || typeof spec.sourceLabel !== "string") continue;
    const safeSpec: InfographicSpec = {
      id: typeof spec.id === "string" && spec.id ? spec.id : `graphic-${graphics.length + 1}`,
      template: spec.template === "comparison" || spec.template === "stat" || spec.template === "timeline" || spec.template === "checklist" ? spec.template : "steps",
      title: spec.title,
      insight: spec.insight,
      items: spec.items.filter((item): item is string => typeof item === "string").slice(0, 12),
      sourceLabel: spec.sourceLabel,
      altText: spec.altText,
    };
    graphics.push({ name: safeSpec.id, svg: renderInfographicSvg(safeSpec), alt: safeSpec.altText });
  }
  return graphics;
}

export function prepareWebflowDraft(input: WebflowDraftRequest) {
  if (typeof input.websiteId !== "string" || !input.websiteId.trim()) {
    throw new Error("Complete onboarding before sending an article to Webflow.");
  }
  if (input.approved !== true || input.generationStatus !== "generated") {
    throw new Error("Approve the completed article before sending it to Webflow.");
  }

  const auditId = typeof input.auditId === "string" ? input.auditId.trim() : "";
  const keyword = typeof input.keyword === "string" ? input.keyword.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!auditId || !keyword || !title || body.length < 100) {
    throw new Error("The approved article is incomplete. Review it before sending it to Webflow.");
  }

  const contentHtml = renderArticleMarkdownToHtml(body).replace(/^<h1>.*?<\/h1>/, "");
  if (!contentHtml) throw new Error("The approved article has no content to send.");

  return {
    websiteId: input.websiteId.trim(),
    articleKey: `${auditId}:${keyword}`.slice(0, 500),
    title,
    contentHtml,
    metaDescription: typeof input.metaDescription === "string" ? input.metaDescription.trim().slice(0, 500) : "",
    wordCount: markdownWordCount(body),
    graphics: prepareInfographics(input.infographics),
  };
}
