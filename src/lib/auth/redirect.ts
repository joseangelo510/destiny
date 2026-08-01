const internalOrigin = "https://destiny.internal";

/** Return a same-origin path, query, and hash or the dashboard fallback. */
export function safeInternalPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, internalOrigin);
    if (url.origin !== internalOrigin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
