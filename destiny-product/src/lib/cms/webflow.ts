export type WebflowCollectionField = {
  slug?: unknown;
  displayName?: unknown;
  type?: unknown;
  isRequired?: unknown;
  isEditable?: unknown;
};

export type WebflowFieldMapping = {
  titleField: string;
  bodyFields: { slug: string; label: string }[];
};

export type WebflowCollectionEvaluation =
  | { compatible: true; mapping: WebflowFieldMapping }
  | { compatible: false; reason: string };

export function prepareWebflowToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token || token.length < 20 || /\s/.test(token)) {
    throw new Error("Enter a valid Webflow site API token (Site settings → Apps & integrations → API access).");
  }
  return token;
}

/**
 * Decides whether Destiny can deliver draft articles into a Webflow CMS
 * collection without breaking the collection's own validation rules.
 *
 * Compatible means: the built-in "name" field exists for the title, at least
 * one editable RichText field can hold the article body, and no other
 * required editable field would block item creation.
 */
export function evaluateWebflowCollection(fields: WebflowCollectionField[]): WebflowCollectionEvaluation {
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
      reason: `This collection requires ${blockers.map((field) => `“${field.label}”`).join(", ")}, which Destiny cannot fill safely.`,
    };
  }

  return {
    compatible: true,
    mapping: { titleField: "name", bodyFields: bodyFields.map((field) => ({ slug: field.slug, label: field.label })) },
  };
}

export function resolveWebflowBodyField(evaluation: WebflowCollectionEvaluation, requested: unknown) {
  if (!evaluation.compatible) throw new Error(evaluation.reason);
  const requestedSlug = typeof requested === "string" ? requested.trim() : "";
  if (!requestedSlug) return evaluation.mapping.bodyFields[0].slug;
  const match = evaluation.mapping.bodyFields.find((field) => field.slug === requestedSlug);
  if (!match) throw new Error("Choose one of the collection's rich-text fields for the article body.");
  return match.slug;
}
