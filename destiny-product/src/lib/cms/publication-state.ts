export type CmsPublicationState =
  | "delivering"
  | "delivered_draft"
  | "scheduled"
  | "published_unverified"
  | "verified_live"
  | "changed_in_cms"
  | "stale"
  | "unpublished"
  | "delivery_failed"
  | "verification_failed"
  | "delivered_incomplete";

export function publicationCopy(state: CmsPublicationState) {
  const copy: Record<CmsPublicationState, { label: string; detail: string }> = {
    delivering: { label: "Sending to WordPress", detail: "Destiny is creating the draft and uploading its graphics." },
    delivered_draft: { label: "Draft delivered", detail: "The article is saved in WordPress and is not live." },
    scheduled: { label: "Scheduled", detail: "WordPress has scheduled this article for publication." },
    published_unverified: { label: "Published — checking", detail: "WordPress reports this article as published. Destiny is checking the public page." },
    verified_live: { label: "Verified live", detail: "Destiny verified the public URL, canonical, article content, and indexability." },
    changed_in_cms: { label: "Changed in WordPress", detail: "The WordPress version changed after Destiny delivered it. Review the current editor version." },
    stale: { label: "Status needs refresh", detail: "Destiny has not checked WordPress recently." },
    unpublished: { label: "No longer published", detail: "The article was previously live but WordPress no longer reports it as published." },
    delivery_failed: { label: "Delivery failed", detail: "Destiny could not finish sending the article to WordPress." },
    verification_failed: { label: "Published — needs review", detail: "WordPress reports the article as published, but the public verification did not pass." },
    delivered_incomplete: { label: "Draft needs attention", detail: "The article reached WordPress, but one or more planned fields or graphics did not." },
  };
  return copy[state];
}

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return value.replace(/\/+$/, "");
  }
}

function plainText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

export function verifyPublicWordPressPage(input: {
  status: number;
  html: string;
  permalink: string;
  title: string;
  fingerprint: string;
}) {
  const renderedTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(input.html)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const canonical = /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i.exec(input.html)?.[1]
    ?? /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i.exec(input.html)?.[1]
    ?? "";
  const robots = Array.from(input.html.matchAll(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/gi)).map((match) => match[1]).join(" ");
  const indexable = !/\bnoindex\b/i.test(robots);
  const canonicalMatches = Boolean(canonical) && normalizedUrl(canonical) === normalizedUrl(input.permalink);
  const text = plainText(input.html);
  const expectedTerms = plainText(input.fingerprint || input.title).split(" ").filter(Boolean);
  const matched = expectedTerms.filter((term) => text.includes(term)).length;
  const contentMatches = expectedTerms.length > 0 && matched / expectedTerms.length >= 0.8;

  let reason = "";
  if (input.status < 200 || input.status >= 300) reason = `The public URL returned HTTP ${input.status}.`;
  else if (!indexable) reason = "The published page is marked noindex.";
  else if (!canonicalMatches) reason = "The canonical URL does not match the WordPress permalink.";
  else if (!contentMatches) reason = "The public page does not contain the delivered article fingerprint.";

  return {
    verified: !reason,
    reason,
    renderedTitle,
    canonical,
    canonicalMatches,
    contentMatches,
    indexable,
    httpStatus: input.status,
  };
}
