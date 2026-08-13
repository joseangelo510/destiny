export type WebflowDraftGraphic = { name: string; svg: string; alt: string };

export type WebflowDraftBody = {
  websiteId?: unknown;
  articleKey?: unknown;
  title?: unknown;
  contentHtml?: unknown;
  metaDescription?: unknown;
  wordCount?: unknown;
  graphics?: unknown;
};

export function prepareDraftBody(body: WebflowDraftBody) {
  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  const articleKey = typeof body.articleKey === "string" ? body.articleKey.trim().slice(0, 500) : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const contentHtml = typeof body.contentHtml === "string" ? body.contentHtml.trim() : "";
  if (!websiteId || !articleKey || !title || contentHtml.length < 100) {
    throw new Error("The approved article is incomplete.");
  }
  const metaDescription = typeof body.metaDescription === "string" ? body.metaDescription.trim().slice(0, 500) : "";
  const wordCount = typeof body.wordCount === "number" && Number.isFinite(body.wordCount) && body.wordCount > 0
    ? Math.floor(body.wordCount)
    : 0;
  const graphics: WebflowDraftGraphic[] = [];
  if (Array.isArray(body.graphics)) {
    for (const entry of body.graphics.slice(0, 3)) {
      if (!entry || typeof entry !== "object") continue;
      const graphic = entry as Record<string, unknown>;
      const svg = typeof graphic.svg === "string" ? graphic.svg : "";
      const alt = typeof graphic.alt === "string" ? graphic.alt.trim().slice(0, 300) : "";
      const name = typeof graphic.name === "string" ? graphic.name.trim().slice(0, 80) : "";
      if (!svg.startsWith("<svg") || svg.length > 200_000 || !alt) continue;
      graphics.push({ name: name || `graphic-${graphics.length + 1}`, svg, alt });
    }
  }
  return { websiteId, articleKey, title, contentHtml, metaDescription, wordCount, graphics };
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
 * A pending claim is a lease, not a lock: a worker that dies mid-transfer must
 * not wedge the article forever. After the lease expires the row can be
 * reclaimed (still via a conditional update, so exactly one caller wins).
 */
export const PENDING_LEASE_MS = 3 * 60_000;

export function canReclaimPendingTransfer(updatedAtIso: unknown, nowMs: number) {
  if (typeof updatedAtIso !== "string" || !updatedAtIso) return true;
  const updatedAt = Date.parse(updatedAtIso);
  if (Number.isNaN(updatedAt)) return true;
  return nowMs - updatedAt >= PENDING_LEASE_MS;
}

export function readingTimeMinutes(wordCount: number) {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 0;
  return Math.max(1, Math.round(wordCount / 225));
}

export type WebflowFieldSchema = {
  slug?: unknown;
  displayName?: unknown;
  type?: unknown;
  isEditable?: unknown;
  isRequired?: unknown;
  validations?: { options?: Array<{ id?: unknown; name?: unknown }> } | null;
};

export type FieldReportEntry = {
  field: string;
  label: string;
  status: "transferred" | "needs_review" | "unavailable";
  note: string;
};

type NormalizedField = { slug: string; label: string; type: string; searchText: string; options: Array<{ id: string; name: string }> };

function normalizeFields(fields: WebflowFieldSchema[]) {
  const normalized: NormalizedField[] = [];
  for (const field of fields) {
    const slug = typeof field.slug === "string" ? field.slug : "";
    const type = typeof field.type === "string" ? field.type : "";
    if (!slug || !type || field.isEditable === false) continue;
    const label = typeof field.displayName === "string" && field.displayName ? field.displayName : slug;
    const options = Array.isArray(field.validations?.options)
      ? field.validations!.options!.flatMap((option) => typeof option.id === "string" && option.id
        ? [{ id: option.id, name: typeof option.name === "string" ? option.name : "" }]
        : [])
      : [];
    normalized.push({ slug, label, type, searchText: `${slug} ${label}`.toLowerCase(), options });
  }
  return normalized;
}

/**
 * Established values come from items already in the selected collection (or an
 * explicit per-connection default), never from cross-client guesses. Returns
 * the most frequent non-empty value per requested slug.
 */
export function establishedFieldValues(items: Array<{ fieldData?: unknown }>, slugs: string[]) {
  const values: Record<string, unknown> = {};
  for (const slug of slugs) {
    const counts = new Map<string, { value: unknown; count: number }>();
    for (const item of items) {
      const fieldData = item.fieldData && typeof item.fieldData === "object" ? item.fieldData as Record<string, unknown> : {};
      const value = fieldData[slug];
      if (value === null || value === undefined || value === "") continue;
      const key = JSON.stringify(value);
      const entry = counts.get(key) ?? { value, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    let best: { value: unknown; count: number } | null = null;
    for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
    if (best) values[slug] = best.value;
  }
  return values;
}

export type WebflowArticleContent = {
  title: string;
  contentHtml: string;
  metaDescription: string;
  wordCount: number;
  publishDateIso: string;
  graphics: Array<{ url: string; alt: string }>;
};

export type WebflowFieldPlan = {
  fieldData: Record<string, unknown>;
  /** fieldData minus volatile values (publish date, slug) so identical content hashes identically across days. */
  stableFieldData: Record<string, unknown>;
  imageFieldSlugs: string[];
  report: FieldReportEntry[];
};

/**
 * Schema-aware mapping: populate every compatible field the selected
 * collection actually has, and report truthfully on the rest. `established`
 * carries values sampled from the collection or configured per connection.
 */
export function planWebflowFieldData(input: {
  fields: WebflowFieldSchema[];
  titleField: string;
  bodyField: string;
  article: WebflowArticleContent;
  established: Record<string, unknown>;
  slug: string;
  includeSlug: boolean;
}): WebflowFieldPlan {
  const { article } = input;
  const titleField = input.titleField || "name";
  const fieldData: Record<string, unknown> = {
    [titleField]: article.title.slice(0, 256),
    [input.bodyField]: article.contentHtml,
  };
  if (input.includeSlug) fieldData.slug = input.slug;
  const imageFieldSlugs: string[] = [];
  const report: FieldReportEntry[] = [
    { field: titleField, label: "Title", status: "transferred", note: "Article SEO title." },
    { field: "slug", label: "Slug", status: "transferred", note: input.includeSlug ? "Stable, collision-safe slug generated by Destiny." : "Existing slug kept — updates never change a draft's slug." },
    { field: input.bodyField, label: "Body", status: "transferred", note: "Article body as rich text with heading and list structure preserved." },
  ];
  let metaDescriptionMapped = false;
  let graphicsMapped = false;

  const volatileSlugs = new Set<string>(["slug"]);
  for (const field of normalizeFields(input.fields)) {
    if (field.slug === titleField || field.slug === input.bodyField || field.slug === "slug") continue;
    const text = field.searchText;
    const establishedValue = input.established[field.slug];

    // Explicit summary semantics only: a field like "Meta Keywords" or
    // "SEO Title" must never be silently overwritten with a description.
    if ((field.type === "PlainText" || field.type === "TextArea") && /summary|excerpt|teaser|descri/.test(text) && !/author|keyword|title|tag/.test(text)) {
      if (article.metaDescription) {
        fieldData[field.slug] = article.metaDescription;
        report.push({ field: field.slug, label: field.label, status: "transferred", note: "Article meta description." });
        metaDescriptionMapped = true;
      } else {
        report.push({ field: field.slug, label: field.label, status: "needs_review", note: "The article has no meta description yet." });
      }
      continue;
    }
    if (field.type === "PlainText" && /author/.test(text)) {
      if (establishedValue !== undefined) {
        fieldData[field.slug] = establishedValue;
        report.push({ field: field.slug, label: field.label, status: "transferred", note: "Author reused from your existing collection items." });
      } else {
        report.push({ field: field.slug, label: field.label, status: "needs_review", note: "No established author found in this collection — set it in Webflow or on the connection." });
      }
      continue;
    }
    if (field.type === "Image" && /author|avatar/.test(text)) {
      if (establishedValue !== undefined) {
        fieldData[field.slug] = establishedValue;
        imageFieldSlugs.push(field.slug);
        report.push({ field: field.slug, label: field.label, status: "transferred", note: "Author image reused from your existing collection items." });
      } else {
        report.push({ field: field.slug, label: field.label, status: "needs_review", note: "No established author image found in this collection." });
      }
      continue;
    }
    if (field.type === "Image" && /thumb|main|hero|feature|cover|image|photo/.test(text)) {
      const graphic = article.graphics[0];
      if (graphic) {
        fieldData[field.slug] = { url: graphic.url, alt: graphic.alt };
        imageFieldSlugs.push(field.slug);
        report.push({ field: field.slug, label: field.label, status: "transferred", note: "Destiny original graphic with its alt text." });
        graphicsMapped = true;
      } else {
        report.push({ field: field.slug, label: field.label, status: "needs_review", note: "No article graphic available — add an image in Webflow." });
      }
      continue;
    }
    if (field.type === "DateTime" && /publish|posted|date/.test(text)) {
      fieldData[field.slug] = article.publishDateIso;
      volatileSlugs.add(field.slug);
      report.push({ field: field.slug, label: field.label, status: "transferred", note: "Set to the send date — adjust in Webflow if you are scheduling for later." });
      continue;
    }
    if (field.type === "Number" && /read|min/.test(text)) {
      const minutes = readingTimeMinutes(article.wordCount);
      if (minutes > 0) {
        fieldData[field.slug] = minutes;
        report.push({ field: field.slug, label: field.label, status: "transferred", note: `Calculated from the article's ${article.wordCount} words.` });
      } else {
        report.push({ field: field.slug, label: field.label, status: "needs_review", note: "Destiny could not calculate a reading time for this article." });
      }
      continue;
    }
    if (field.type === "Option" && /categor|topic|tag|type|section/.test(text)) {
      const optionId = resolveOptionValue(establishedValue, field.options);
      if (optionId) {
        fieldData[field.slug] = optionId;
        report.push({ field: field.slug, label: field.label, status: "transferred", note: "Category reused from your existing collection items." });
      } else {
        report.push({ field: field.slug, label: field.label, status: "needs_review", note: "Pick a category in Webflow — Destiny only reuses categories already established in this collection." });
      }
      continue;
    }
    report.push({ field: field.slug, label: field.label, status: "needs_review", note: "Destiny has no matching article content for this field — review it in Webflow." });
  }

  if (article.metaDescription && !metaDescriptionMapped) {
    report.push({ field: "", label: "Meta description", status: "unavailable", note: "This collection has no summary/description field to receive it." });
  }
  if (article.graphics.length && !graphicsMapped) {
    report.push({ field: "", label: "Article graphics", status: "unavailable", note: "This collection has no image field to receive Destiny's graphics." });
  }
  if (article.graphics.length > 1) {
    report.push({ field: "", label: `Additional graphics (${article.graphics.length - 1})`, status: "needs_review", note: "Download the remaining Destiny graphics and place them in the article body in Webflow." });
  }

  const stableFieldData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fieldData)) {
    if (!volatileSlugs.has(key)) stableFieldData[key] = value;
  }
  return { fieldData, stableFieldData, imageFieldSlugs, report };
}

function resolveOptionValue(established: unknown, options: Array<{ id: string; name: string }>) {
  if (typeof established !== "string" || !established) return "";
  if (options.some((option) => option.id === established)) return established;
  const byName = options.find((option) => option.name.toLowerCase() === established.toLowerCase());
  return byName ? byName.id : "";
}

/** Drop image fields from a payload so a Webflow rejection of an external image URL can fall back without losing the transfer. */
export function stripImageFieldData(fieldData: Record<string, unknown>, imageFieldSlugs: string[]) {
  const stripped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fieldData)) {
    if (!imageFieldSlugs.includes(key)) stripped[key] = value;
  }
  return stripped;
}

/**
 * The payload always sets isDraft: true and isArchived: false. There is no
 * code path that can produce a live item.
 */
export function webflowItemPayload(fieldData: Record<string, unknown>) {
  return { isArchived: false, isDraft: true as const, fieldData };
}

/**
 * Staged-item endpoints only. Destiny never calls /items/live or any publish
 * endpoint, so nothing can appear on the public site without the owner
 * publishing from Webflow themselves.
 */
export function webflowCreateItemEndpoint(collectionId: string) {
  return `https://api.webflow.com/v2/collections/${encodeURIComponent(collectionId)}/items`;
}

/** PATCH target for update-in-place: same staged item, same slug, still a draft. */
export function webflowUpdateItemEndpoint(collectionId: string, itemId: string) {
  return `https://api.webflow.com/v2/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`;
}

export function webflowCollectionEndpoint(collectionId: string) {
  return `https://api.webflow.com/v2/collections/${encodeURIComponent(collectionId)}`;
}

export function webflowListItemsEndpoint(collectionId: string) {
  return `https://api.webflow.com/v2/collections/${encodeURIComponent(collectionId)}/items?limit=100`;
}

/** Recover an orphaned item after a partial failure: same deterministic slug means it is ours. */
export function findItemIdBySlug(items: Array<{ id?: unknown; fieldData?: unknown }>, slug: string) {
  for (const item of items) {
    const fieldData = item.fieldData && typeof item.fieldData === "object" ? item.fieldData as Record<string, unknown> : {};
    if (fieldData.slug === slug && typeof item.id === "string" && item.id) return item.id;
  }
  return "";
}

export function webflowEditUrl(siteShortName: string) {
  return siteShortName
    ? `https://webflow.com/design/${encodeURIComponent(siteShortName)}`
    : "https://webflow.com/dashboard";
}

export function classifyWebflowFailure(status: number) {
  return status === 401 || status === 403 ? "authorization_failed" : "webflow_rejected";
}
