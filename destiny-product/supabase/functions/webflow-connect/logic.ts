export const WEBFLOW_API_BASE = "https://api.webflow.com/v2";

export type WebflowField = {
  slug?: unknown;
  displayName?: unknown;
  type?: unknown;
  isRequired?: unknown;
  isEditable?: unknown;
};

export type CollectionEvaluation =
  | { compatible: true; titleField: string; bodyFields: { slug: string; label: string }[] }
  | { compatible: false; reason: string };

export function prepareToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token || token.length < 20 || /\s/.test(token)) {
    throw new Error("Enter a valid Webflow site API token.");
  }
  return token;
}

/** Mirrors src/lib/cms/webflow.ts — the server never trusts a client-side mapping. */
export function evaluateCollectionFields(fields: WebflowField[]): CollectionEvaluation {
  const normalized = fields.map((field) => ({
    slug: typeof field.slug === "string" ? field.slug : "",
    label: typeof field.displayName === "string" && field.displayName ? field.displayName : (typeof field.slug === "string" ? field.slug : ""),
    type: typeof field.type === "string" ? field.type : "",
    required: field.isRequired === true,
    editable: field.isEditable !== false,
  })).filter((field) => field.slug);

  if (!normalized.some((field) => field.slug === "name")) {
    return { compatible: false, reason: "This collection has no name field for the article title." };
  }
  const bodyFields = normalized.filter((field) => field.type === "RichText" && field.editable);
  if (!bodyFields.length) {
    return { compatible: false, reason: "This collection has no rich-text field to hold the article body." };
  }
  const bodySlugs = new Set(bodyFields.map((field) => field.slug));
  const blockers = normalized.filter((field) =>
    field.required && field.editable && field.slug !== "name" && field.slug !== "slug" && !bodySlugs.has(field.slug));
  if (blockers.length) {
    return {
      compatible: false,
      reason: `This collection requires ${blockers.map((field) => `“${field.label}”`).join(", ")}, which Rebound SEO cannot fill safely.`,
    };
  }
  return { compatible: true, titleField: "name", bodyFields: bodyFields.map((field) => ({ slug: field.slug, label: field.label })) };
}

export function selectBodyField(evaluation: CollectionEvaluation, requested: unknown) {
  if (!evaluation.compatible) throw new Error(evaluation.reason);
  const requestedSlug = typeof requested === "string" ? requested.trim() : "";
  if (!requestedSlug) return evaluation.bodyFields[0].slug;
  const match = evaluation.bodyFields.find((field) => field.slug === requestedSlug);
  if (!match) throw new Error("Choose one of the collection's rich-text fields for the article body.");
  return match.slug;
}

export function webflowSitesEndpoint() {
  return `${WEBFLOW_API_BASE}/sites`;
}

export function webflowCollectionsEndpoint(siteId: string) {
  return `${WEBFLOW_API_BASE}/sites/${encodeURIComponent(siteId)}/collections`;
}

export function webflowCollectionEndpoint(collectionId: string) {
  return `${WEBFLOW_API_BASE}/collections/${encodeURIComponent(collectionId)}`;
}
