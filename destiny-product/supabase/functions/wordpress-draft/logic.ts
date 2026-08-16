export type WordPressDraftBody = {
  websiteId?: unknown;
  articleKey?: unknown;
  title?: unknown;
  metaTitle?: unknown;
  contentHtml?: unknown;
  excerpt?: unknown;
  media?: unknown;
};

export type WordPressMediaRole = "featured" | "inline";
export type WordPressMediaInput = {
  filename: string;
  mimeType: string;
  base64: string;
  alt: string;
  role: WordPressMediaRole;
  caption: string;
  placementAfterHeading: string;
};
export type UploadedWordPressMedia = Omit<WordPressMediaInput, "filename" | "mimeType" | "base64"> & { id: number; sourceUrl: string };

function mediaInputs(value: unknown) {
  if (!Array.isArray(value)) return [] as WordPressMediaInput[];
  return value.slice(0, 4).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const filename = typeof item.filename === "string" ? item.filename.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 120) : `destiny-graphic-${index + 1}.webp`;
    const mimeType = item.mimeType === "image/png" ? "image/png" : "image/webp";
    const base64 = typeof item.base64 === "string" ? item.base64 : "";
    const alt = typeof item.alt === "string" ? item.alt.trim().slice(0, 300) : "";
    const role: WordPressMediaRole = item.role === "featured" ? "featured" : "inline";
    const caption = typeof item.caption === "string" ? item.caption.trim().slice(0, 500) : "";
    const placementAfterHeading = typeof item.placementAfterHeading === "string" ? item.placementAfterHeading.trim().slice(0, 300) : "";
    if (!base64 || base64.length > 8_000_000 || !alt) return [];
    return [{ filename, mimeType, base64, alt, role, caption, placementAfterHeading }];
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
  const inline = media.filter((item) => item.role === "inline");
  if (!inline.length) return contentHtml;
  const figure = (item: UploadedWordPressMedia) => `<!-- wp:image {"id":${item.id},"sizeSlug":"large"} --><figure class="wp-block-image size-large destiny-article-figure"><img src="${escapeAttribute(item.sourceUrl)}" alt="${escapeAttribute(item.alt)}" class="wp-image-${item.id}" />${item.caption ? `<figcaption class="wp-element-caption">${escapeAttribute(item.caption)}</figcaption>` : ""}</figure><!-- /wp:image -->`;
  let output = contentHtml;
  const pending: UploadedWordPressMedia[] = [];
  const headingBlockPattern = /(?:<!-- wp:heading\b[\s\S]*?-->)?<h([23])\b[^>]*>[\s\S]*?<\/h\1>(?:<!-- \/wp:heading -->)?/gi;
  for (const item of inline) {
    let inserted = false;
    const target = plainText(item.placementAfterHeading);
    if (target) {
      output = output.replace(headingBlockPattern, (heading) => {
        if (inserted || plainText(heading) !== target) return heading;
        inserted = true;
        return `${heading}${figure(item)}`;
      });
    }
    if (!inserted) pending.push(item);
  }
  let fallbackIndex = 0;
  const h2BlockPattern = /(?:<!-- wp:heading\b[\s\S]*?-->)?<h2\b[^>]*>[\s\S]*?<\/h2>(?:<!-- \/wp:heading -->)?/gi;
  output = output.replace(h2BlockPattern, (heading) => {
    if (fallbackIndex >= pending.length) return heading;
    if (/destiny-article-figure[\s\S]*$/.test(heading)) return heading;
    return `${heading}${figure(pending[fallbackIndex++])}`;
  });
  if (fallbackIndex < pending.length) {
    const remaining = pending.slice(fallbackIndex).map(figure).join("");
    output = output.replace(/<\/div><!-- \/wp:group -->\s*$/, `${remaining}</div><!-- /wp:group -->`);
    if (!output.includes(remaining)) output += remaining;
  }
  return output;
}

export function wordpressDraftPayload(draft: ReturnType<typeof prepareDraftBody>, media: UploadedWordPressMedia[] = []) {
  const featured = media.find((item) => item.role === "featured");
  return {
    title: draft.title,
    content: insertWordPressFigures(draft.contentHtml, media),
    excerpt: draft.excerpt,
    status: "draft" as const,
    ...(featured ? { featured_media: featured.id } : {}),
  };
}

export function verifyDeliveredDraftMedia(
  remote: { featuredMedia: number; contentHtml: string },
  media: UploadedWordPressMedia[],
) {
  if (/<!-- wp:heading\b[\s\S]*?<!-- wp:image\b[\s\S]*?<!-- \/wp:heading -->/i.test(remote.contentHtml)) {
    return { verified: false, reason: "WordPress placed an inline image inside a heading block instead of after it." };
  }
  const featured = media.find((item) => item.role === "featured");
  if (featured && remote.featuredMedia !== featured.id) {
    return { verified: false, reason: "WordPress did not save the required featured image." };
  }
  for (const item of media.filter((candidate) => candidate.role === "inline")) {
    if (!remote.contentHtml.includes(`wp-image-${item.id}`) || !remote.contentHtml.includes(`alt="${escapeAttribute(item.alt)}"`)) {
      return { verified: false, reason: `WordPress did not preserve inline image ${item.id} and its alt text.` };
    }
  }
  return { verified: true, reason: "" };
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

export function wordpressPostEndpoint(siteUrl: string, remoteId = "") {
  const base = `${siteUrl.replace(/\/+$/, "")}/wp-json/wp/v2/posts`;
  return remoteId ? `${base}/${encodeURIComponent(remoteId)}` : base;
}

export function canUpdateWordPressDraft(remoteStatus: string) {
  return remoteStatus === "draft" || remoteStatus === "pending" || remoteStatus === "private";
}
