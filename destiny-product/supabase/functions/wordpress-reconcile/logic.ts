export type PublicVerificationInput = {
  status: number;
  html: string;
  permalink: string;
  fingerprint: string;
};

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

export function plainText(value: string) {
  return value
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

export function fingerprintMatches(html: string, fingerprint: string) {
  const text = plainText(html);
  const terms = plainText(fingerprint).split(" ").filter(Boolean);
  return terms.length > 0 && terms.filter((term) => text.includes(term)).length / terms.length >= 0.8;
}

export function verifyPublicPage(input: PublicVerificationInput) {
  const renderedTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(input.html)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const canonical = /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i.exec(input.html)?.[1]
    ?? /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i.exec(input.html)?.[1]
    ?? "";
  const robots = Array.from(input.html.matchAll(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/gi)).map((match) => match[1]).join(" ");
  const indexable = !/\bnoindex\b/i.test(robots);
  const canonicalMatches = Boolean(canonical) && normalizedUrl(canonical) === normalizedUrl(input.permalink);
  const contentMatches = fingerprintMatches(input.html, input.fingerprint);
  let reason = "";
  if (input.status < 200 || input.status >= 300) reason = `The public URL returned HTTP ${input.status}.`;
  else if (!indexable) reason = "The published page is marked noindex.";
  else if (!canonicalMatches) reason = "The canonical URL does not match the WordPress permalink.";
  else if (!contentMatches) reason = "The public page does not contain the delivered article fingerprint.";
  return { verified: !reason, reason, renderedTitle, canonical, canonicalMatches, contentMatches, indexable, httpStatus: input.status };
}

export function publicationState(remoteStatus: string, contentMatches: boolean, publicVerified?: boolean) {
  if (remoteStatus === "future") return "scheduled" as const;
  if (remoteStatus === "publish") return publicVerified ? "verified_live" as const : "verification_failed" as const;
  if (remoteStatus === "trash") return "unpublished" as const;
  if (remoteStatus === "draft" || remoteStatus === "pending" || remoteStatus === "private") {
    return contentMatches ? "delivered_draft" as const : "changed_in_cms" as const;
  }
  return "stale" as const;
}
