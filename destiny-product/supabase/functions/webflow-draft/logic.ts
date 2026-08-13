export type WebflowDraftBody = {
  websiteId?: unknown;
  articleKey?: unknown;
  title?: unknown;
  contentHtml?: unknown;
};

export function prepareDraftBody(body: WebflowDraftBody) {
  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  const articleKey = typeof body.articleKey === "string" ? body.articleKey.trim().slice(0, 500) : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const contentHtml = typeof body.contentHtml === "string" ? body.contentHtml.trim() : "";
  if (!websiteId || !articleKey || !title || contentHtml.length < 100) {
    throw new Error("The approved article is incomplete.");
  }
  return { websiteId, articleKey, title, contentHtml };
}

/** Deterministic so retries of the same article always produce the same slug. */
export function webflowItemSlug(title: string, articleKey: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "destiny-article";
  let hash = 5381;
  for (let index = 0; index < articleKey.length; index += 1) {
    hash = ((hash << 5) + hash + articleKey.charCodeAt(index)) >>> 0;
  }
  return `${base}-${hash.toString(36)}`;
}

/**
 * The payload always sets isDraft: true and isArchived: false. There is no
 * code path that can produce a live item.
 */
export function webflowItemPayload(draft: ReturnType<typeof prepareDraftBody>, titleField: string, bodyField: string) {
  return {
    isArchived: false,
    isDraft: true as const,
    fieldData: {
      [titleField || "name"]: draft.title.slice(0, 256),
      slug: webflowItemSlug(draft.title, draft.articleKey),
      [bodyField]: draft.contentHtml,
    },
  };
}

/**
 * Staged-item creation only. Destiny never calls the /items/live or any
 * publish endpoint, so nothing can appear on the public site without the
 * owner publishing from Webflow themselves.
 */
export function webflowCreateItemEndpoint(collectionId: string) {
  return `https://api.webflow.com/v2/collections/${encodeURIComponent(collectionId)}/items`;
}

export function webflowEditUrl(siteShortName: string) {
  return siteShortName
    ? `https://webflow.com/design/${encodeURIComponent(siteShortName)}`
    : "https://webflow.com/dashboard";
}

export function classifyWebflowFailure(status: number) {
  return status === 401 || status === 403 ? "authorization_failed" : "webflow_rejected";
}
