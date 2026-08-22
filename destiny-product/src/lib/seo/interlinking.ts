import type { SeoKeyword, SeoSitePage } from "./types";

export type InterlinkInventoryPage = {
  url: string;
  title: string;
  text: string;
  role: SeoSitePage["role"];
  targetTerms: string[];
  bestRank: number;
  searchVolume: number;
  published: boolean;
};

export type InterlinkPageSnapshot = InterlinkInventoryPage & {
  statusCode: number;
  indexable: boolean;
  canonicalUrl: string;
  links: Array<{ url: string; anchor: string }>;
};

export type InterlinkOpportunity = {
  sourceUrl: string;
  sourceTitle: string;
  targetUrl: string;
  targetTitle: string;
  anchorText: string;
  sourceSentence: string;
  reason: string;
  score: number;
  priority: "high" | "medium" | "low";
};

export type InterlinkStatus = "suggested" | "approved" | "skipped" | "done_claimed" | "verified";
export type InterlinkAction = "approve" | "skip" | "mark_done";

export function interlinkStatusTransition(status: InterlinkStatus, action: InterlinkAction): InterlinkStatus | null {
  if (action === "approve" && (status === "suggested" || status === "skipped")) return "approved";
  if (action === "skip" && (status === "suggested" || status === "approved")) return "skipped";
  if (action === "mark_done" && status === "approved") return "done_claimed";
  return null;
}

export function reconcileFreshOpportunityState(previous: { status?: InterlinkStatus; verifiedAt?: string | null; verifiedAnchor?: string | null } | null | undefined) {
  const contradicted = previous?.status === "verified" || previous?.status === "done_claimed";
  return {
    status: contradicted ? "approved" as const : previous?.status ?? "suggested" as const,
    verifiedAt: contradicted ? null : previous?.verifiedAt ?? null,
    verifiedAnchor: contradicted ? null : previous?.verifiedAnchor ?? null,
  };
}

type InventoryKeyword = Pick<SeoKeyword, "keyword" | "url" | "rank" | "searchVolume">;

const BLOCKED_EXTENSIONS = /\.(?:avif|css|csv|docx?|gif|ico|jpe?g|js|json|mp3|mp4|mov|pdf|png|pptx?|svg|txt|webm|webp|xlsx?|xml|zip)$/i;
const GENERIC_TERMS = new Set(["about us", "contact us", "home page", "learn more", "read more"]);

function normalizedHost(value: string) {
  try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export function isSafePublicWebsiteUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return false;
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
    if (!ipv4) return true;
    if (ipv4.some((part) => part < 0 || part > 255)) return false;
    const [a, b] = ipv4;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
  } catch { return false; }
}

export function normalizeInternalUrl(value: string, websiteUrl: string) {
  const websiteHost = normalizedHost(websiteUrl);
  if (!websiteHost || !value.trim()) return null;
  try {
    const parsed = new URL(value, websiteUrl.includes("://") ? websiteUrl : `https://${websiteUrl}`);
    if (!/^https?:$/.test(parsed.protocol) || normalizedHost(parsed.href) !== websiteHost || BLOCKED_EXTENSIONS.test(parsed.pathname)) return null;
    parsed.protocol = "https:";
    parsed.hostname = websiteHost;
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/");
    if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString();
  } catch { return null; }
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildInterlinkInventory(input: {
  websiteUrl: string;
  auditPages: Array<Partial<SeoSitePage> & { url: string }>;
  keywords: InventoryKeyword[];
  publishedPages: Array<{ url: string; title?: string | null }>;
}) {
  const byUrl = new Map<string, InterlinkInventoryPage>();
  const ensure = (rawUrl: string, values: Partial<InterlinkInventoryPage> = {}) => {
    const url = normalizeInternalUrl(rawUrl, input.websiteUrl);
    if (!url) return null;
    const current = byUrl.get(url) ?? {
      url,
      title: url === normalizeInternalUrl(input.websiteUrl, input.websiteUrl) ? "Homepage" : new URL(url).pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") || "Website page",
      text: "",
      role: "other" as const,
      targetTerms: [],
      bestRank: 0,
      searchVolume: 0,
      published: false,
    };
    const merged: InterlinkInventoryPage = {
      ...current,
      ...values,
      title: values.title?.trim() || current.title,
      text: values.text?.trim() || current.text,
      targetTerms: uniqueStrings([...(current.targetTerms ?? []), ...(values.targetTerms ?? [])]),
      bestRank: [current.bestRank, values.bestRank].filter((rank): rank is number => typeof rank === "number" && rank > 0).sort((a, b) => a - b)[0] ?? 0,
      searchVolume: Math.max(current.searchVolume, values.searchVolume ?? 0),
      published: current.published || values.published === true,
    };
    byUrl.set(url, merged);
    return merged;
  };

  for (const page of input.auditPages) ensure(page.url, {
    title: typeof page.title === "string" ? page.title : "",
    text: typeof page.text === "string" ? page.text : "",
    role: page.role ?? "other",
  });
  for (const keyword of input.keywords) {
    if (!keyword.url) continue;
    ensure(keyword.url, { targetTerms: [keyword.keyword], bestRank: keyword.rank, searchVolume: keyword.searchVolume });
  }
  for (const page of input.publishedPages) ensure(page.url, { title: page.title ?? "", published: true });
  const roleScore = (page: InterlinkInventoryPage) => page.role === "homepage" ? 5_000 : page.published ? 4_500 : page.targetTerms.length ? 4_000 : page.role === "product" || page.role === "how_it_works" ? 3_000 : page.text ? 2_000 : 1_000;
  return [...byUrl.values()].sort((a, b) => roleScore(b) - roleScore(a) || (a.bestRank || 999) - (b.bestRank || 999) || b.searchVolume - a.searchVolume || a.url.localeCompare(b.url)).slice(0, 25);
}

function decodeHtml(value: string) {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function attribute(tag: string, name: string) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function canonicalFromHtml(html: string, pageUrl: string, websiteUrl: string) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!attribute(tag, "rel").toLowerCase().split(/\s+/).includes("canonical")) continue;
    return normalizeInternalUrl(attribute(tag, "href"), websiteUrl) ?? pageUrl;
  }
  return pageUrl;
}

export function snapshotFromHtml(input: { page: InterlinkInventoryPage; html: string; statusCode: number; websiteUrl: string; xRobotsTag?: string | null }): InterlinkPageSnapshot {
  const withoutNoise = input.html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ");
  const title = stripHtml(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(withoutNoise)?.[1] ?? "") || input.page.title;
  const robots = [...withoutNoise.matchAll(/<meta\b[^>]*>/gi)].flatMap((match) => {
    const tag = match[0];
    return attribute(tag, "name").toLowerCase() === "robots" ? [attribute(tag, "content").toLowerCase()] : [];
  }).join(",");
  const links = [...withoutNoise.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].flatMap((match) => {
    const url = normalizeInternalUrl(attribute(match[0], "href"), input.websiteUrl);
    if (!url) return [];
    return [{ url, anchor: stripHtml(match[0]) }];
  }).filter((link, index, all) => all.findIndex((candidate) => candidate.url === link.url && candidate.anchor === link.anchor) === index);
  const canonicalUrl = canonicalFromHtml(withoutNoise, input.page.url, input.websiteUrl);
  return {
    ...input.page,
    title,
    text: stripHtml(withoutNoise).slice(0, 60_000),
    statusCode: input.statusCode,
    indexable: input.statusCode === 200 && !/(?:^|[,\s])noindex(?:$|[,\s])/i.test(`${robots},${input.xRobotsTag ?? ""}`),
    canonicalUrl,
    links,
  };
}

export async function fetchInterlinkPage(page: InterlinkInventoryPage, websiteUrl: string, fetcher: typeof fetch = fetch) {
  try {
    const response = await fetcher(page.url, {
      headers: { "user-agent": "DestinySEO/1.0 (+https://destiny-seo.replit.app)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return { ...page, statusCode: response.status, indexable: false, canonicalUrl: page.url, links: [] } satisfies InterlinkPageSnapshot;
    return snapshotFromHtml({ page, html: await response.text(), statusCode: response.status, websiteUrl, xRobotsTag: response.headers.get("x-robots-tag") });
  } catch {
    return { ...page, statusCode: 0, indexable: false, canonicalUrl: page.url, links: [] } satisfies InterlinkPageSnapshot;
  }
}

function sentenceWith(text: string, phrase: string) {
  const phraseIndex = text.toLocaleLowerCase().indexOf(phrase.toLocaleLowerCase());
  if (phraseIndex < 0) return null;
  const startBoundary = Math.max(text.lastIndexOf(".", phraseIndex), text.lastIndexOf("!", phraseIndex), text.lastIndexOf("?", phraseIndex));
  const after = text.slice(phraseIndex + phrase.length);
  const endings = [after.indexOf("."), after.indexOf("!"), after.indexOf("?")].filter((index) => index >= 0);
  const endBoundary = endings.length ? phraseIndex + phrase.length + Math.min(...endings) + 1 : Math.min(text.length, phraseIndex + phrase.length + 180);
  return text.slice(startBoundary + 1, endBoundary).trim().slice(0, 400);
}

function displayAnchor(sentence: string, phrase: string) {
  const index = sentence.toLocaleLowerCase().indexOf(phrase.toLocaleLowerCase());
  return index >= 0 ? sentence.slice(index, index + phrase.length) : phrase;
}

function usefulPhrase(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  const words = clean.split(" ").filter(Boolean);
  return clean.length <= 90 && words.length >= 2 && !GENERIC_TERMS.has(clean.toLowerCase());
}

function scoreOpportunity(target: InterlinkPageSnapshot, source: InterlinkPageSnapshot) {
  const rankBoost = target.bestRank >= 4 && target.bestRank <= 20 ? 34 - target.bestRank : target.bestRank > 0 && target.bestRank <= 50 ? 12 : 4;
  const volumeBoost = Math.min(24, Math.round(Math.log10(Math.max(1, target.searchVolume)) * 8));
  const sourceBoost = source.role === "homepage" ? 12 : source.role === "product" || source.role === "how_it_works" ? 8 : 4;
  return rankBoost + volumeBoost + sourceBoost;
}

export function findInterlinkOpportunities(pages: InterlinkPageSnapshot[], websiteUrl: string): InterlinkOpportunity[] {
  const cleanPages = pages.filter((page) => page.statusCode === 200 && page.indexable && normalizeInternalUrl(page.canonicalUrl, websiteUrl) === normalizeInternalUrl(page.url, websiteUrl));
  const candidates: InterlinkOpportunity[] = [];
  for (const source of cleanPages) {
    for (const target of cleanPages) {
      if (source.url === target.url || source.links.some((link) => normalizeInternalUrl(link.url, websiteUrl) === target.url)) continue;
      const phrases = uniqueStrings([...target.targetTerms, target.title]).filter(usefulPhrase).sort((a, b) => b.length - a.length);
      const phrase = phrases.find((candidate) => source.text.toLocaleLowerCase().includes(candidate.toLocaleLowerCase()));
      if (!phrase) continue;
      const sourceSentence = sentenceWith(source.text, phrase);
      if (!sourceSentence) continue;
      const score = scoreOpportunity(target, source);
      candidates.push({
        sourceUrl: source.url,
        sourceTitle: source.title,
        targetUrl: target.url,
        targetTitle: target.title,
        anchorText: displayAnchor(sourceSentence, phrase),
        sourceSentence,
        reason: target.bestRank >= 4 && target.bestRank <= 20
          ? `This relevant page can strengthen a page already ranking #${target.bestRank}.`
          : "The source already mentions this topic but does not link to the verified destination.",
        score,
        priority: score >= 50 ? "high" : score >= 30 ? "medium" : "low",
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.sourceUrl.localeCompare(b.sourceUrl) || a.targetUrl.localeCompare(b.targetUrl));
  const sourceCounts = new Map<string, number>();
  const targetCounts = new Map<string, number>();
  return candidates.filter((candidate) => {
    if ((sourceCounts.get(candidate.sourceUrl) ?? 0) >= 3 || (targetCounts.get(candidate.targetUrl) ?? 0) >= 5) return false;
    sourceCounts.set(candidate.sourceUrl, (sourceCounts.get(candidate.sourceUrl) ?? 0) + 1);
    targetCounts.set(candidate.targetUrl, (targetCounts.get(candidate.targetUrl) ?? 0) + 1);
    return true;
  });
}

export function verifyImplementedLink(html: string, sourceUrl: string, targetUrl: string) {
  for (const match of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const href = normalizeInternalUrl(attribute(match[0], "href"), sourceUrl);
    if (href === normalizeInternalUrl(targetUrl, sourceUrl)) return { found: true, anchor: stripHtml(match[0]) };
  }
  return { found: false, anchor: "" };
}
