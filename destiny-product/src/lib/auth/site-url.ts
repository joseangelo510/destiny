export function siteOrigin(configuredSiteUrl: string | undefined, requestOrigin: string | null) {
  for (const candidate of [configuredSiteUrl, requestOrigin]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if (url.protocol === "https:" || (url.protocol === "http:" && isLocal)) return url.origin;
    } catch {
      // Try the next source when a proxy supplies an invalid origin.
    }
  }
  return "http://localhost:3000";
}

/** Build a browser-facing redirect without leaking an internal reverse-proxy origin. */
export function siteRedirectUrl(
  configuredSiteUrl: string | undefined,
  requestUrl: string,
  destination: string,
) {
  let requestOrigin: string | null = null;
  try {
    requestOrigin = new URL(requestUrl).origin;
  } catch {
    // siteOrigin will use the configured public URL or its local fallback.
  }
  return new URL(destination, siteOrigin(configuredSiteUrl, requestOrigin));
}
