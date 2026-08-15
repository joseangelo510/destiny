export type WordPressDraftBody = {
  websiteId?: unknown;
  articleKey?: unknown;
  title?: unknown;
  metaTitle?: unknown;
  contentHtml?: unknown;
  excerpt?: unknown;
  media?: unknown;
};

export type WordPressMediaInput = { filename: string; mimeType: string; base64: string; alt: string };
export type UploadedWordPressMedia = { id: number; sourceUrl: string; alt: string };

function mediaInputs(value: unknown) {
  if (!Array.isArray(value)) return [] as WordPressMediaInput[];
  return value.slice(0, 3).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const filename = typeof item.filename === "string" ? item.filename.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 120) : `destiny-graphic-${index + 1}.webp`;
    const mimeType = item.mimeType === "image/png" ? "image/png" : "image/webp";
    const base64 = typeof item.base64 === "string" ? item.base64 : "";
    const alt = typeof item.alt === "string" ? item.alt.trim().slice(0, 300) : "";
    if (!base64 || base64.length > 8_000_000 || !alt) return [];
    return [{ filename, mimeType, base64, alt }];
  });
}

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
  return { websiteId, articleKey, title, metaTitle, contentHtml, excerpt, media: mediaInputs(body.media) };
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function insertWordPressFigures(contentHtml: string, media: UploadedWordPressMedia[]) {
  if (!media.length) return contentHtml;
  let index = 0;
  const withSections = contentHtml.replace(/(<h2\b[^>]*>[\s\S]*?<\/h2>)/gi, (heading) => {
    if (index >= media.length) return heading;
    const item = media[index++];
    return `${heading}<figure class="wp-block-image"><img src="${escapeAttribute(item.sourceUrl)}" alt="${escapeAttribute(item.alt)}" /></figure>`;
  });
  if (index >= media.length) return withSections;
  return `${withSections}${media.slice(index).map((item) => `<figure class="wp-block-image"><img src="${escapeAttribute(item.sourceUrl)}" alt="${escapeAttribute(item.alt)}" /></figure>`).join("")}`;
}

export function wordpressDraftPayload(draft: ReturnType<typeof prepareDraftBody>, media: UploadedWordPressMedia[] = []) {
  return {
    title: draft.title,
    content: insertWordPressFigures(draft.contentHtml, media),
    excerpt: draft.excerpt,
    status: "draft" as const,
    ...(media[0] ? { featured_media: media[0].id } : {}),
  };
}

function plainText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function contentFingerprint(title: string, contentHtml: string) {
  return plainText(`${title} ${contentHtml}`).split(" ").slice(0, 28).join(" ");
}

export function wordpressEditUrl(siteUrl: string, remoteId: string) {
  return `${siteUrl.replace(/\/+$/, "")}/wp-admin/post.php?post=${encodeURIComponent(remoteId)}&action=edit`;
}
