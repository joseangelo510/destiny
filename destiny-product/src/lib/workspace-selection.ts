export const ACTIVE_WEBSITE_COOKIE = "destiny_active_website";

const WEBSITE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WebsiteSelectionCandidate = {
  id: string;
  normalized_domain?: string | null;
  business_name?: string | null;
  products_services?: string | null;
  onboarding_completed_at?: string | null;
  updated_at?: string | null;
};

export function isWebsiteId(value: unknown): value is string {
  return typeof value === "string" && WEBSITE_ID_PATTERN.test(value);
}

function domainKey(website: WebsiteSelectionCandidate) {
  return website.normalized_domain?.trim().toLocaleLowerCase().replace(/^www\./, "") || website.id;
}

function completeness(website: WebsiteSelectionCandidate) {
  return Number(Boolean(website.business_name?.trim())) + Number(Boolean(website.products_services?.trim()));
}

function preferredWebsite<T extends WebsiteSelectionCandidate>(left: T, right: T) {
  const onboarding = Number(Boolean(right.onboarding_completed_at)) - Number(Boolean(left.onboarding_completed_at));
  if (onboarding) return onboarding;
  const context = completeness(right) - completeness(left);
  if (context) return context;
  const recency = Date.parse(right.updated_at ?? "") - Date.parse(left.updated_at ?? "");
  if (Number.isFinite(recency) && recency) return recency;
  return left.id.localeCompare(right.id);
}

export function canonicalWebsites<T extends WebsiteSelectionCandidate>(websites: T[], preferredId?: string | null): T[] {
  const groups = new Map<string, T[]>();
  for (const website of websites) {
    const key = domainKey(website);
    groups.set(key, [...(groups.get(key) ?? []), website]);
  }
  return [...groups.values()].map((candidates) => {
    const explicit = preferredId ? candidates.find((candidate) => candidate.id === preferredId) : null;
    return explicit ?? [...candidates].sort(preferredWebsite)[0];
  });
}

export function activeWebsiteFrom<T extends WebsiteSelectionCandidate>(websites: T[], requestedId: unknown): T | null {
  if (!websites.length) return null;
  if (isWebsiteId(requestedId)) {
    const explicit = websites.find((website) => website.id === requestedId);
    if (explicit) return explicit;
  }
  return canonicalWebsites(websites)[0] ?? null;
}

export function siteScopedHref(href: string, websiteId: unknown) {
  if (!isWebsiteId(websiteId) || !href.startsWith("/")) return href;
  const url = new URL(href, "https://destiny.local");
  url.searchParams.set("site", websiteId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function shouldPersistWebsiteSelection(headers: Headers) {
  const isPrefetch = headers.get("next-router-prefetch") === "1"
    || headers.get("x-middleware-prefetch") === "1"
    || /prefetch/i.test(headers.get("purpose") ?? "")
    || /prefetch/i.test(headers.get("sec-purpose") ?? "");
  return !isPrefetch;
}

export const activeWebsiteCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};
