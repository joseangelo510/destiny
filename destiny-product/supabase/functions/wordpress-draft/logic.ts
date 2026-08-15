export type WordPressDraftBody = {
  websiteId?: unknown;
  articleKey?: unknown;
  title?: unknown;
  metaTitle?: unknown;
  contentHtml?: unknown;
  excerpt?: unknown;
};

export function prepareDraftBody(body: WordPressDraftBody) {
  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  const articleKey = typeof body.articleKey === "string" ? body.articleKey.trim().slice(0, 500) : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const metaTitle = typeof body.metaTitle === "string" && body.metaTitle.trim() ? body.metaTitle.trim().slice(0, 160) : title;
  const contentHtml = typeof body.contentHtml === "string" ? body.contentHtml.trim() : "";
  const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim().slice(0, 280) : "";
  if (!websiteId || !articleKey || !title || contentHtml.length < 100) {
    throw new Error("The approved article is incomplete.");
  }
  return { websiteId, articleKey, title, metaTitle, contentHtml, excerpt };
}

export function wordpressDraftPayload(draft: ReturnType<typeof prepareDraftBody>) {
  return {
    title: draft.title,
    content: draft.contentHtml,
    excerpt: draft.excerpt,
    status: "draft" as const,
  };
}

export function wordpressEditUrl(siteUrl: string, remoteId: string) {
  return `${siteUrl.replace(/\/+$/, "")}/wp-admin/post.php?post=${encodeURIComponent(remoteId)}&action=edit`;
}
