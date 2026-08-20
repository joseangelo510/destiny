/**
 * repurpose-url.ts
 *
 * Secure URL-ingestion library for the Repurpose feature.
 *
 * - Allows only public http/https URLs
 * - Resolves DNS (both A + AAAA via lookup all:true) and blocks
 *   localhost / private / link-local / metadata / reserved ranges (IPv4 + IPv6)
 * - Follows up to 3 redirects with redirect:manual, re-validates each hop
 * - Rejects Content-Length > 2 MB before reading; streams body with in-flight cap
 * - Caps response at 2 MB and 12 s
 * - Accepts public HTML / plain-text pages
 * - Extracts page title + readable text
 * - Detects YouTube URLs and extracts captions from captionTracks without any secret
 *   (watch + caption fetches also use manual redirects with hop revalidation)
 * - Typed errors with plain-English recovery guidance
 *
 * DNS and fetch are injectable for deterministic Vitest coverage.
 */

import * as dnsPromises from "node:dns/promises";
import * as http from "node:http";
import * as https from "node:https";
import { Readable } from "node:stream";

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
export const FETCH_TIMEOUT_MS = 12_000; // 12 s
export const MAX_REDIRECTS = 3;

// ─── Error types ─────────────────────────────────────────────────────────────

export class RepurposeUrlError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_URL"
      | "PRIVATE_HOST"
      | "UNSUPPORTED_SCHEME"
      | "TOO_MANY_REDIRECTS"
      | "TIMEOUT"
      | "RESPONSE_TOO_LARGE"
      | "HTTP_ERROR"
      | "PAYWALL"
      | "JS_ONLY"
      | "NO_CONTENT"
      | "NO_CAPTIONS"
      | "UNSUPPORTED_CONTENT_TYPE",
  ) {
    super(message);
    this.name = "RepurposeUrlError";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UrlIngestionResult {
  url: string;
  title: string;
  text: string;
  /** "youtube" when captions were fetched, "html" or "text" otherwise */
  source: "youtube" | "html" | "text";
}

/** Injectable DNS resolver (returns array of IP strings). */
export type DnsResolver = (hostname: string) => Promise<string[]>;

/**
 * Injectable fetch.
 * The response may optionally expose a ReadableStream body for streaming reads.
 * redirect must support "manual".
 */
export type FetchFn = (
  url: string,
  init?: {
    signal?: AbortSignal;
    redirect?: "manual" | "follow" | "error";
    headers?: Record<string, string>;
    /** Public addresses already validated for this exact request hop. */
    resolvedAddresses?: string[];
  },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  /** Optional streaming body; if absent the library falls back to arrayBuffer(). */
  body?: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export interface UrlIngestionDeps {
  dns?: DnsResolver;
  fetch?: FetchFn;
}

// ─── SSRF block-list ─────────────────────────────────────────────────────────

/**
 * Returns true if the IPv4 address string falls in a reserved / private range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed → treat as private
  }
  const [a, b, c] = parts;
  return (
    a === 0 || // 0.0.0.0/8 – "this" network
    a === 10 || // 10.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 – shared address space
    a === 127 || // 127.0.0.0/8 – loopback
    (a === 169 && b === 254) || // 169.254.0.0/16 – link-local
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24 – IETF protocol
    (a === 192 && b === 0 && c === 2) || // 192.0.2.0/24 – TEST-NET-1
    (a === 192 && b === 88 && c === 99) || // 192.88.99.0/24 – 6to4 relay (deprecated)
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 198 && b >= 18 && b <= 19) || // 198.18.0.0/15 – benchmarking
    (a === 198 && b === 51 && c === 100) || // 198.51.100.0/24 – TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // 203.0.113.0/24 – TEST-NET-3
    a >= 224 // 224.0.0.0+ – multicast and reserved
  );
}

function parseIPv4Bytes(raw: string): number[] | null {
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((part) => Number(part));
  if (bytes.some((value, index) => (
    !/^\d{1,3}$/.test(parts[index])
    || !Number.isInteger(value)
    || value < 0
    || value > 255
  ))) return null;
  return bytes;
}

/** Parse compressed, mixed, or fully-expanded IPv6 text into exactly 16 bytes. */
function parseIPv6Bytes(raw: string): Uint8Array | null {
  let ip = raw.toLowerCase().replace(/^\[|\]$/g, "");
  const zoneIndex = ip.indexOf("%");
  if (zoneIndex >= 0) ip = ip.slice(0, zoneIndex);

  if (ip.includes(".")) {
    const separator = ip.lastIndexOf(":");
    if (separator < 0) return null;
    const v4 = parseIPv4Bytes(ip.slice(separator + 1));
    if (!v4) return null;
    ip = `${ip.slice(0, separator)}:${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }

  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const parseHalf = (value: string) => value
    ? value.split(":").map((group) => (
        /^[0-9a-f]{1,4}$/.test(group) ? Number.parseInt(group, 16) : Number.NaN
      ))
    : [];
  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] ?? "");
  if ([...left, ...right].some(Number.isNaN)) return null;

  const compressed = halves.length === 2;
  const missing = 8 - left.length - right.length;
  if ((compressed && missing < 1) || (!compressed && missing !== 0)) return null;
  const groups = compressed
    ? [...left, ...Array<number>(missing).fill(0), ...right]
    : left;
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  groups.forEach((group, index) => {
    bytes[index * 2] = group >> 8;
    bytes[index * 2 + 1] = group & 0xff;
  });
  return bytes;
}

function embeddedIPv4(bytes: Uint8Array) {
  return `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}

/**
 * Returns true for non-global IPv6 and reserved/tunneled ranges.
 * Binary parsing prevents alternate compressed forms from bypassing checks.
 */
function isPrivateIPv6(raw: string): boolean {
  const bytes = parseIPv6Bytes(raw);
  if (!bytes) return true;

  const firstTwelveZero = bytes.slice(0, 12).every((value) => value === 0);
  const ipv4Mapped = bytes.slice(0, 10).every((value) => value === 0)
    && bytes[10] === 0xff
    && bytes[11] === 0xff;
  if (ipv4Mapped) return isPrivateIPv4(embeddedIPv4(bytes));
  // Deprecated IPv4-compatible forms are ambiguous and not valid public URL targets.
  if (firstTwelveZero) return true;

  // Only globally routable unicast (2000::/3) is eligible.
  if ((bytes[0] & 0xe0) !== 0x20) return true;

  return (
    hasPrefix(bytes, [0x20, 0x01, 0x00, 0x00]) || // Teredo 2001:0000::/32
    hasPrefix(bytes, [0x20, 0x01, 0x00, 0x02]) || // benchmarking 2001:2::/48
    (hasPrefix(bytes, [0x20, 0x01, 0x00]) && (bytes[3] & 0xf0) === 0x10) || // ORCHIDv1 2001:10::/28
    (hasPrefix(bytes, [0x20, 0x01, 0x00]) && (bytes[3] & 0xf0) === 0x20) || // ORCHIDv2 2001:20::/28
    hasPrefix(bytes, [0x20, 0x01, 0x0d, 0xb8]) || // documentation 2001:db8::/32
    hasPrefix(bytes, [0x20, 0x02]) || // 6to4 embeds another address family
    (bytes[0] === 0x3f && (bytes[1] & 0xf0) === 0xf0) // documentation 3fff::/20
  );
}

function isPrivateAddress(address: string): boolean {
  const stripped = address.replace(/^\[|\]$/g, "");
  if (stripped.includes(":")) return isPrivateIPv6(stripped);
  return isPrivateIPv4(stripped);
}

// ─── URL validation ────────────────────────────────────────────────────────────

function parsePublicUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new RepurposeUrlError(
      `"${raw}" is not a valid URL. Enter a full URL starting with https:// or http://.`,
      "INVALID_URL",
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new RepurposeUrlError(
      `Only http and https URLs are supported. "${parsed.protocol}" is not allowed.`,
      "UNSUPPORTED_SCHEME",
    );
  }
  return parsed;
}

async function checkHostNotPrivate(
  hostname: string,
  resolver: DnsResolver,
): Promise<string[]> {
  const bare = hostname.replace(/^\[|\]$/g, "");

  // Reject by name patterns first (no DNS needed)
  const lower = bare.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".example") ||
    lower.endsWith(".invalid") ||
    lower.endsWith(".test")
  ) {
    throw new RepurposeUrlError(
      `"${hostname}" is a private or reserved hostname and cannot be fetched.`,
      "PRIVATE_HOST",
    );
  }

  // If it looks like a raw IP, check immediately without DNS
  const isRawIp =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(bare) || bare.includes(":");
  if (isRawIp) {
    if (isPrivateAddress(bare)) {
      throw new RepurposeUrlError(
        `The IP address "${bare}" is in a reserved range and cannot be fetched.`,
        "PRIVATE_HOST",
      );
    }
    return [bare];
  }

  // Resolve DNS and check every returned address (both IPv4 and IPv6)
  let addresses: string[];
  try {
    addresses = await resolver(bare);
  } catch {
    throw new RepurposeUrlError(
      `The hostname "${hostname}" could not be resolved. Check the URL and try again.`,
      "INVALID_URL",
    );
  }
  if (addresses.length === 0) {
    throw new RepurposeUrlError(
      `The hostname "${hostname}" did not resolve to an address. Check the URL and try again.`,
      "INVALID_URL",
    );
  }

  for (const addr of addresses) {
    if (isPrivateAddress(addr)) {
      throw new RepurposeUrlError(
        `"${hostname}" resolves to the private address ${addr} and cannot be fetched.`,
        "PRIVATE_HOST",
      );
    }
  }
  return addresses;
}

// ─── Bounded body reader ──────────────────────────────────────────────────────

/**
 * Read the response body with a strict 2 MB in-flight cap.
 *
 * Strategy:
 *   1. If Content-Length header is present and > MAX_RESPONSE_BYTES → reject immediately.
 *   2. If response.body (ReadableStream) is available → stream with byte counter.
 *   3. Otherwise fall back to arrayBuffer() and check size after reading.
 *
 * This prevents unbounded memory allocation from calling arrayBuffer() on an
 * unknown-size response in production.
 */
async function readBoundedBody(
  res: Awaited<ReturnType<FetchFn>>,
  urlStr: string,
  signal?: AbortSignal,
): Promise<string> {
  // 1. Content-Length preflight
  const clHeader = res.headers.get("content-length");
  if (clHeader !== null) {
    const cl = parseInt(clHeader, 10);
    if (!isNaN(cl) && cl > MAX_RESPONSE_BYTES) {
      throw new RepurposeUrlError(
        `The page at "${urlStr}" advertises ${(cl / 1024 / 1024).toFixed(1)} MB (Content-Length), which exceeds the 2 MB limit. Try a more specific URL or paste the content directly.`,
        "RESPONSE_TOO_LARGE",
      );
    }
  }

  // 2. Streaming read via ReadableStream if available
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > MAX_RESPONSE_BYTES) {
            reader.cancel().catch(() => {});
            throw new RepurposeUrlError(
              `The page at "${urlStr}" exceeds the 2 MB streaming limit. Try a more specific URL or paste the content directly.`,
              "RESPONSE_TOO_LARGE",
            );
          }
          chunks.push(value);
        }
      }
    } catch (err: unknown) {
      if (err instanceof RepurposeUrlError) throw err;
      if (signal?.aborted) {
        throw new RepurposeUrlError(
          `The request to ${new URL(urlStr).hostname} timed out after ${FETCH_TIMEOUT_MS / 1000} seconds. Try again later.`,
          "TIMEOUT",
        );
      }
      throw new RepurposeUrlError(
        `Failed to stream the response from "${urlStr}": ${err instanceof Error ? err.message : String(err)}`,
        "HTTP_ERROR",
      );
    }

    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(combined);
  }

  // 3. Fallback: arrayBuffer() (acceptable in test mocks that don't provide body stream)
  let buf: ArrayBuffer;
  try {
    buf = await res.arrayBuffer();
  } catch {
    if (signal?.aborted) {
      throw new RepurposeUrlError(
        `The request to ${new URL(urlStr).hostname} timed out after ${FETCH_TIMEOUT_MS / 1000} seconds. Try again later.`,
        "TIMEOUT",
      );
    }
    throw new RepurposeUrlError(
      `Failed to read the response from "${urlStr}".`,
      "HTTP_ERROR",
    );
  }
  if (buf.byteLength > MAX_RESPONSE_BYTES) {
    throw new RepurposeUrlError(
      `The page at "${urlStr}" is larger than 2 MB. Try a more specific URL or paste the content directly.`,
      "RESPONSE_TOO_LARGE",
    );
  }
  return new TextDecoder().decode(buf);
}

// ─── YouTube caption extraction ───────────────────────────────────────────────

const YT_HOSTNAME_RE = /^(www\.|m\.)?youtube\.com$|^youtu\.be$/i;

function isYouTubeUrl(url: URL): boolean {
  return YT_HOSTNAME_RE.test(url.hostname);
}

function extractVideoId(url: URL): string | null {
  const v = url.searchParams.get("v");
  if (v) return v;
  const match = url.pathname.match(/^\/([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

interface CaptionTrack {
  baseUrl: string;
  name?: { simpleText?: string };
  languageCode?: string;
  kind?: string;
}

/**
 * Perform a single fetch hop (no auto-redirect) with timeout + bounded body.
 * Returns { body, finalUrl, contentType, status, ok } after following up to
 * maxHops redirects.
 *
 * Does NOT throw on non-2xx status — the caller decides how to handle it.
 */
async function fetchWithManualRedirects(
  startUrl: string,
  fetchFn: FetchFn,
  resolver: DnsResolver,
  maxHops: number,
  extraHeaders?: Record<string, string>,
): Promise<{ body: string; finalUrl: string; contentType: string | null; status: number; ok: boolean }> {
  let current = new URL(startUrl);
  let redirectCount = 0;

  while (true) {
    const resolvedAddresses = await checkHostNotPrivate(current.hostname, resolver);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    let res: Awaited<ReturnType<FetchFn>>;
    try {
      res = await fetchFn(current.toString(), {
        signal: ctrl.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RepurposeBot/1.0)",
          ...extraHeaders,
        },
        resolvedAddresses,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof RepurposeUrlError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("abort") ||
        msg.toLowerCase().includes("signal")
      ) {
        throw new RepurposeUrlError(
          `The request to ${current.hostname} timed out after ${FETCH_TIMEOUT_MS / 1000} seconds. Try again later.`,
          "TIMEOUT",
        );
      }
      throw new RepurposeUrlError(
        `Could not reach ${current.toString()}: ${msg}`,
        "HTTP_ERROR",
      );
    }
    const status = res.status;

    // Redirect
    if (status >= 300 && status < 400) {
      clearTimeout(timer);
      const location = res.headers.get("location");
      if (!location) {
        throw new RepurposeUrlError(
          `The server at ${current.hostname} returned a redirect (${status}) with no Location header.`,
          "HTTP_ERROR",
        );
      }
      redirectCount++;
      if (redirectCount > maxHops) {
        throw new RepurposeUrlError(
          `Too many redirects (more than ${maxHops}) while loading ${startUrl}. Check that the URL is correct.`,
          "TOO_MANY_REDIRECTS",
        );
      }
      let next: URL;
      try {
        next = new URL(location, current.toString());
      } catch {
        throw new RepurposeUrlError(
          `A redirect led to an invalid URL: "${location}".`,
          "INVALID_URL",
        );
      }
      if (next.protocol !== "https:" && next.protocol !== "http:") {
        throw new RepurposeUrlError(
          `A redirect led to a non-http(s) URL: "${next.protocol}".`,
          "UNSUPPORTED_SCHEME",
        );
      }
      current = next;
      continue;
    }

    const contentType = res.headers.get("content-type");
    let body: string;
    try {
      body = await readBoundedBody(res, current.toString(), ctrl.signal);
    } finally {
      clearTimeout(timer);
    }
    return {
      body,
      finalUrl: current.toString(),
      contentType,
      status: res.status,
      ok: res.ok,
    };
  }
}

async function fetchYouTubeCaptions(
  videoUrl: URL,
  fetchFn: FetchFn,
  resolver: DnsResolver,
): Promise<UrlIngestionResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new RepurposeUrlError(
      "Could not determine the YouTube video ID from the URL.",
      "INVALID_URL",
    );
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  let pageHtml: string;
  try {
    const resp = await fetchWithManualRedirects(
      watchUrl,
      fetchFn,
      resolver,
      MAX_REDIRECTS,
      { Accept: "text/html,*/*;q=0.8" },
    );
    if (!resp.ok) {
      throw new RepurposeUrlError(
        `YouTube returned HTTP ${resp.status} for video ${videoId}. The video may be private or unavailable.`,
        "HTTP_ERROR",
      );
    }
    pageHtml = resp.body;
  } catch (err: unknown) {
    if (err instanceof RepurposeUrlError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new RepurposeUrlError(`Could not reach YouTube: ${msg}`, "HTTP_ERROR");
  }

  // Extract title
  const titleMatch = pageHtml.match(/<title>([^<]+)<\/title>/i);
  const rawTitle = titleMatch
    ? titleMatch[1].replace(/ - YouTube$/, "").trim()
    : `YouTube video ${videoId}`;

  // Extract captionTracks JSON blob
  const tracksMatch = pageHtml.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])/);
  if (!tracksMatch) {
    throw new RepurposeUrlError(
      `No captions are available for this YouTube video (${videoId}). Add captions or transcript to the video, or paste the transcript directly.`,
      "NO_CAPTIONS",
    );
  }

  let tracks: CaptionTrack[];
  try {
    tracks = JSON.parse(tracksMatch[1]);
  } catch {
    throw new RepurposeUrlError(
      `The caption metadata for video ${videoId} could not be parsed.`,
      "NO_CAPTIONS",
    );
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new RepurposeUrlError(
      `No captions are available for this YouTube video (${videoId}). Add captions or paste the transcript directly.`,
      "NO_CAPTIONS",
    );
  }

  const preferred =
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode?.startsWith("en")) ||
    tracks[0];

  if (!preferred?.baseUrl) {
    throw new RepurposeUrlError(
      `Caption track has no download URL for video ${videoId}.`,
      "NO_CAPTIONS",
    );
  }

  let captionXml: string;
  try {
    const resp = await fetchWithManualRedirects(
      preferred.baseUrl,
      fetchFn,
      resolver,
      MAX_REDIRECTS,
    );
    if (!resp.ok) {
      throw new RepurposeUrlError(
        `Could not download captions for video ${videoId} (HTTP ${resp.status}).`,
        "NO_CAPTIONS",
      );
    }
    captionXml = resp.body;
  } catch (err: unknown) {
    if (err instanceof RepurposeUrlError) throw err;
    throw new RepurposeUrlError(
      `Caption download failed for video ${videoId}.`,
      "NO_CAPTIONS",
    );
  }

  // Parse the XML caption format: <text start="..." dur="...">...</text>
  const segments: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(captionXml)) !== null) {
    const decoded = m[1]
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\n/g, " ")
      .trim();
    if (decoded) segments.push(decoded);
  }

  const text = segments.join(" ").slice(0, 120_000);

  if (!text.trim()) {
    throw new RepurposeUrlError(
      `The captions for video ${videoId} appear to be empty. Paste the transcript directly.`,
      "NO_CAPTIONS",
    );
  }

  return {
    url: videoUrl.toString(),
    title: rawTitle,
    text,
    source: "youtube",
  };
}

// ─── General URL fetching ─────────────────────────────────────────────────────

const ACCEPTED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "application/xhtml+xml",
];

function isAcceptedContentType(ct: string | null): boolean {
  if (!ct) return false;
  const base = ct.split(";")[0].trim().toLowerCase();
  return ACCEPTED_CONTENT_TYPES.some((a) => base === a || base.startsWith(a));
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

function extractReadableText(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ");

  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  return cleaned.replace(/\s+/g, " ").trim();
}

function detectPaywall(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("subscribe to continue") ||
    lower.includes("subscribe to read") ||
    lower.includes("create an account to read") ||
    lower.includes("sign in to read") ||
    lower.includes("become a member to read") ||
    lower.includes("premium content") ||
    lower.includes("paywall")
  );
}

function detectJsOnly(html: string, bodyText: string): boolean {
  const lower = html.toLowerCase();
  const hasNoscript = lower.includes("<noscript>");
  const hasReactRoot =
    lower.includes('id="__next"') ||
    lower.includes('id="root"') ||
    lower.includes('id="app"');
  const meaningfulTextLength = bodyText.replace(/\s+/g, "").length;
  return (hasNoscript || hasReactRoot) && meaningfulTextLength < 200;
}

async function fetchPublicUrl(
  startUrl: URL,
  fetchFn: FetchFn,
  resolver: DnsResolver,
): Promise<UrlIngestionResult> {
  let current = startUrl;
  let redirectCount = 0;

  while (true) {
    const resolvedAddresses = await checkHostNotPrivate(current.hostname, resolver);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    let res: Awaited<ReturnType<FetchFn>>;
    try {
      res = await fetchFn(current.toString(), {
        signal: ctrl.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RepurposeBot/1.0)",
          Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
        },
        resolvedAddresses,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof RepurposeUrlError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("abort") ||
        msg.toLowerCase().includes("signal")
      ) {
        throw new RepurposeUrlError(
          `The request to ${current.hostname} timed out after ${
            FETCH_TIMEOUT_MS / 1000
          } seconds. Try again later.`,
          "TIMEOUT",
        );
      }
      throw new RepurposeUrlError(
        `Could not reach ${current.toString()}: ${msg}`,
        "HTTP_ERROR",
      );
    }
    const status = res.status;

    // Manual redirect handling — re-validate each hop
    if (status >= 300 && status < 400) {
      clearTimeout(timer);
      const location = res.headers.get("location");
      if (!location) {
        throw new RepurposeUrlError(
          `The server at ${current.hostname} returned a redirect (${status}) with no Location header.`,
          "HTTP_ERROR",
        );
      }
      redirectCount++;
      if (redirectCount > MAX_REDIRECTS) {
        throw new RepurposeUrlError(
          `Too many redirects (more than ${MAX_REDIRECTS}) while loading ${startUrl.toString()}. Check that the URL is correct.`,
          "TOO_MANY_REDIRECTS",
        );
      }
      let next: URL;
      try {
        next = new URL(location, current.toString());
      } catch {
        throw new RepurposeUrlError(
          `A redirect led to an invalid URL: "${location}".`,
          "INVALID_URL",
        );
      }
      if (next.protocol !== "https:" && next.protocol !== "http:") {
        throw new RepurposeUrlError(
          `A redirect led to a non-http(s) URL: "${next.protocol}".`,
          "UNSUPPORTED_SCHEME",
        );
      }
      current = next;
      continue;
    }

    if (!res.ok) {
      clearTimeout(timer);
      if (status === 401 || status === 403) {
        throw new RepurposeUrlError(
          `Access to "${current.toString()}" was denied (HTTP ${status}). The page may be behind a paywall or login. Paste the content directly instead.`,
          "PAYWALL",
        );
      }
      if (status === 402) {
        throw new RepurposeUrlError(
          `"${current.toString()}" requires payment (HTTP 402). Paste the content directly instead.`,
          "PAYWALL",
        );
      }
      throw new RepurposeUrlError(
        `"${current.toString()}" returned HTTP ${status}. Check the URL or try a different page.`,
        "HTTP_ERROR",
      );
    }

    // Content-type check
    const contentType = res.headers.get("content-type");
    if (!isAcceptedContentType(contentType)) {
      clearTimeout(timer);
      throw new RepurposeUrlError(
        `The URL returned content type "${contentType ?? "(none)"}", which is not supported. Only HTML and plain text pages are accepted.`,
        "UNSUPPORTED_CONTENT_TYPE",
      );
    }

    // Bounded body read (Content-Length preflight + streaming cap)
    let body: string;
    try {
      body = await readBoundedBody(res, current.toString(), ctrl.signal);
    } finally {
      clearTimeout(timer);
    }

    const isPlainText = (contentType ?? "").toLowerCase().includes("text/plain");
    let title: string;
    let text: string;

    if (isPlainText) {
      title =
        current.pathname.split("/").filter(Boolean).pop() ?? current.hostname;
      text = body.slice(0, 120_000);
    } else {
      title = extractTitle(body);
      text = extractReadableText(body);

      if (detectPaywall(body)) {
        throw new RepurposeUrlError(
          `"${current.toString()}" appears to be behind a paywall. Paste the content directly instead.`,
          "PAYWALL",
        );
      }
      if (detectJsOnly(body, text)) {
        throw new RepurposeUrlError(
          `"${current.toString()}" requires JavaScript to render content. Try copying the text directly from the page.`,
          "JS_ONLY",
        );
      }
      if (!text || text.length < 50) {
        throw new RepurposeUrlError(
          `No readable content was found at "${current.toString()}". The page may be empty, require login, or use client-side rendering. Paste the content directly.`,
          "NO_CONTENT",
        );
      }

      text = text.slice(0, 120_000);
    }

    return {
      url: current.toString(),
      title,
      text,
      source: isPlainText ? "text" : "html",
    };
  }
}

// ─── Default DNS resolver ─────────────────────────────────────────────────────

/**
 * Production DNS resolver.
 * Uses dns.lookup with { all: true } to retrieve BOTH A (IPv4) and AAAA (IPv6)
 * records so that dual-stack hosts cannot bypass the SSRF filter by returning
 * only a public IPv4 address while secretly listening on a private IPv6 address.
 */
async function defaultDnsResolver(hostname: string): Promise<string[]> {
  const records = await dnsPromises.lookup(hostname, { all: true });
  return records.map((r) => r.address);
}

/**
 * Production fetch adapter that connects directly to a DNS address validated
 * for this request hop. The original hostname remains in Host and TLS SNI, so
 * certificates and virtual hosts still work without a second DNS lookup.
 */
const defaultPinnedFetch: FetchFn = async (rawUrl, init = {}) => {
  const parsed = new URL(rawUrl);
  const address = init.resolvedAddresses?.[0];
  if (!address || isPrivateAddress(address)) {
    throw new RepurposeUrlError(
      `No validated public address is available for "${parsed.hostname}".`,
      "PRIVATE_HOST",
    );
  }

  return await new Promise((resolve, reject) => {
    const transport = parsed.protocol === "https:" ? https : http;
    const request = transport.request({
      protocol: parsed.protocol,
      hostname: address,
      port: parsed.port || undefined,
      path: `${parsed.pathname}${parsed.search}`,
      method: "GET",
      headers: {
        ...init.headers,
        Host: parsed.host,
      },
      ...(parsed.protocol === "https:" ? { servername: parsed.hostname } : {}),
    }, (response) => {
      const status = response.statusCode ?? 0;
      const readBytes = async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of response) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      };
      resolve({
        ok: status >= 200 && status < 300,
        status,
        headers: {
          get(name: string) {
            const value = response.headers[name.toLowerCase()];
            if (Array.isArray(value)) return value.join(", ");
            return value === undefined ? null : String(value);
          },
        },
        body: Readable.toWeb(response) as ReadableStream<Uint8Array>,
        async text() {
          return (await readBytes()).toString("utf8");
        },
        async arrayBuffer() {
          const value = await readBytes();
          return value.buffer.slice(
            value.byteOffset,
            value.byteOffset + value.byteLength,
          ) as ArrayBuffer;
        },
      });
    });

    const abort = () => {
      request.destroy(Object.assign(new Error("The operation was aborted"), {
        name: "AbortError",
      }));
    };
    if (init.signal?.aborted) abort();
    else init.signal?.addEventListener("abort", abort, { once: true });
    request.on("error", reject);
    request.end();
  });
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ingest a public URL.
 *
 * @param rawUrl  URL string entered by the user.
 * @param deps    Optional injectable DNS resolver and fetch for testing.
 */
export async function ingestSourceUrl(
  rawUrl: string,
  deps: UrlIngestionDeps = {},
): Promise<UrlIngestionResult> {
  const fetchFn = deps.fetch ?? defaultPinnedFetch;
  const resolver = deps.dns ?? defaultDnsResolver;

  const url = parsePublicUrl(rawUrl);

  if (isYouTubeUrl(url)) {
    return fetchYouTubeCaptions(url, fetchFn, resolver);
  }

  return fetchPublicUrl(url, fetchFn, resolver);
}
