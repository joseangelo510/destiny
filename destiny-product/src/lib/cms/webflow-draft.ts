import { renderArticleMarkdownToHtml } from "@/lib/content/article-draft";

export type WebflowDraftRequest = {
  websiteId?: unknown;
  auditId?: unknown;
  keyword?: unknown;
  title?: unknown;
  body?: unknown;
  approved?: unknown;
  generationStatus?: unknown;
};

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
  };
}
