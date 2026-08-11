import { renderArticleMarkdownToHtml } from "@/lib/content/article-draft";

export type WordPressDraftRequest = {
  websiteId?: unknown;
  auditId?: unknown;
  keyword?: unknown;
  title?: unknown;
  body?: unknown;
  metaDescription?: unknown;
  approved?: unknown;
  generationStatus?: unknown;
};

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
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const excerpt = typeof input.metaDescription === "string" ? input.metaDescription.trim().slice(0, 280) : "";
  if (!auditId || !keyword || !title || body.length < 100) {
    throw new Error("The approved article is incomplete. Review it before sending it to WordPress.");
  }

  const contentHtml = renderArticleMarkdownToHtml(body).replace(/^<h1>.*?<\/h1>/, "");
  if (!contentHtml) throw new Error("The approved article has no content to send.");

  return {
    websiteId: input.websiteId.trim(),
    articleKey: `${auditId}:${keyword}`.slice(0, 500),
    title,
    contentHtml,
    excerpt,
  };
}
