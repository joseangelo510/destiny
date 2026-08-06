export const ACTIVE_WEBSITE_COOKIE = "destiny_active_website";

const WEBSITE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isWebsiteId(value: unknown): value is string {
  return typeof value === "string" && WEBSITE_ID_PATTERN.test(value);
}

export function activeWebsiteFrom<T extends { id: string }>(websites: T[], requestedId: unknown): T | null {
  if (!websites.length) return null;
  if (!isWebsiteId(requestedId)) return websites[0];
  return websites.find((website) => website.id === requestedId) ?? websites[0];
}

export function siteScopedHref(href: string, websiteId: unknown) {
  if (!isWebsiteId(websiteId) || !href.startsWith("/")) return href;
  const url = new URL(href, "https://destiny.local");
  url.searchParams.set("site", websiteId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export const activeWebsiteCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};
