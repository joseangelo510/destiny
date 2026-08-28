const KINDS = new Set(["wordpress", "linkedin", "x", "facebook"]);
const GENERIC_SOCIAL_PATHS = [
  /^\/sharing\/share-offsite\/?$/i,
  /^\/intent\/post\/?$/i,
  /^\/sharer\/sharer\.php$/i,
];

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function normalizedHost(value) {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function isSpecificPostUrl(kind, url) {
  if (GENERIC_SOCIAL_PATHS.some((pattern) => pattern.test(url.pathname))) return false;
  if (kind === "wordpress") return url.pathname.split("/").filter(Boolean).length > 0;
  if (kind === "linkedin") return /^\/(?:posts\/[^/]+|feed\/update\/urn:li:activity:\d+)\/?$/i.test(url.pathname);
  if (kind === "x") return /^\/[^/]+\/status\/\d+\/?$/i.test(url.pathname);
  if (kind === "facebook") return /^\/(?:share\/p\/[^/]+|[^/]+\/posts\/[^/]+)\/?$/i.test(url.pathname);
  return false;
}

export function parsePublicArtifactManifest(input) {
  const rows = typeof input === "string" ? JSON.parse(input) : input;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Public artifact manifest must contain at least one artifact.");
  return rows.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Artifact ${index + 1} must be an object.`);
    const label = requiredString(raw.label, `Artifact ${index + 1} label`);
    const websiteId = requiredString(raw.websiteId, `${label} websiteId`);
    const kind = requiredString(raw.kind, `${label} kind`).toLowerCase();
    if (!KINDS.has(kind)) throw new Error(`${label} kind must be wordpress, linkedin, x, or facebook.`);
    const publicUrl = requiredString(raw.publicUrl, `${label} publicUrl`);
    const expectedHost = normalizedHost(requiredString(raw.expectedHost, `${label} expectedHost`));
    const parsedUrl = new URL(publicUrl);
    if (normalizedHost(parsedUrl.hostname) !== expectedHost) throw new Error(`${label} public URL does not match expectedHost.`);
    if (!isSpecificPostUrl(kind, parsedUrl)) throw new Error(`${label} must use a specific public post URL, not a homepage or share intent.`);
    if (!Array.isArray(raw.expectedText) || raw.expectedText.length === 0 || raw.expectedText.some((item) => typeof item !== "string" || !item.trim())) {
      throw new Error(`${label} expectedText must contain at least one exact public content marker.`);
    }
    const expectedCanonical = raw.expectedCanonical ? requiredString(raw.expectedCanonical, `${label} expectedCanonical`) : null;
    if (kind === "wordpress" && !expectedCanonical) throw new Error(`${label} expectedCanonical is required for WordPress proof.`);
    return {
      label,
      websiteId,
      kind,
      publicUrl,
      expectedHost,
      expectedText: raw.expectedText.map((item) => item.trim()),
      expectedCanonical,
    };
  });
}

function canonicalFromHtml(html, baseUrl) {
  const match = html.match(/<link\b[^>]*\brel=["'][^"']*canonical[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["'][^"']*canonical[^"']*["'][^>]*>/i);
  const value = match?.[1] ?? match?.[2];
  return value ? new URL(value, baseUrl).toString() : null;
}

export async function verifyPublicArtifact(rawArtifact, options = {}) {
  const [artifact] = parsePublicArtifactManifest([rawArtifact]);
  const fetcher = options.fetcher ?? fetch;
  const checkedAt = options.checkedAt ?? new Date().toISOString();
  const response = await fetcher(artifact.publicUrl, {
    method: "GET",
    redirect: "follow",
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${artifact.label} public fetch returned HTTP ${response.status}.`);
  const finalUrl = response.url || artifact.publicUrl;
  if (normalizedHost(new URL(finalUrl).hostname) !== artifact.expectedHost) {
    throw new Error(`${artifact.label} redirected to the wrong public host.`);
  }
  const html = await response.text();
  const searchable = html.toLocaleLowerCase("en-US");
  const missing = artifact.expectedText.filter((marker) => !searchable.includes(marker.toLocaleLowerCase("en-US")));
  if (missing.length) throw new Error(`${artifact.label} is missing expected public content: ${missing.join(", ")}.`);

  const canonical = canonicalFromHtml(html, finalUrl);
  const canonicalMatches = artifact.expectedCanonical
    ? Boolean(canonical && normalizeUrl(canonical) === normalizeUrl(artifact.expectedCanonical))
    : null;
  if (artifact.expectedCanonical && !canonicalMatches) throw new Error(`${artifact.label} public canonical does not match the expected article URL.`);

  return {
    label: artifact.label,
    websiteId: artifact.websiteId,
    kind: artifact.kind,
    state: "publicly_verified",
    publicUrl: artifact.publicUrl,
    finalUrl,
    expectedHost: artifact.expectedHost,
    httpStatus: response.status,
    contentType: response.headers.get("content-type") ?? "",
    matchedText: artifact.expectedText,
    canonical,
    canonicalMatches,
    checkedAt,
  };
}

export async function verifyPublicArtifactManifest(input, options = {}) {
  const artifacts = parsePublicArtifactManifest(input);
  const evidence = [];
  for (const artifact of artifacts) evidence.push(await verifyPublicArtifact(artifact, options));
  return evidence;
}
