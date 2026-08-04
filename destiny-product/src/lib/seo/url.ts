export function normalizeWebsite(value: string) {
  const trimmed = value.trim();
  if (trimmed.length > 2048) {
    throw new Error("Website URL is too long.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Website must use http or https.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const isIpAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
  const isLocalName = hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal");
  if (!hostname || !hostname.includes(".") || isIpAddress || isLocalName) {
    throw new Error("Enter a valid public website.");
  }

  url.hash = "";
  url.username = "";
  url.password = "";

  return { url: url.toString(), domain: hostname };
}
