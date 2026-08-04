const internalOrigin = "https://destiny.internal";

/** Return a same-origin path, query, and hash or the authenticated dashboard fallback. */
export function safeInternalPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/app";
  try {
    const url = new URL(value, internalOrigin);
    if (url.origin !== internalOrigin) return "/app";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/app";
  }
}
