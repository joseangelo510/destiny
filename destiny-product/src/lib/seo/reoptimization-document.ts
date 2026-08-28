import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ReoptimizationResearchResult } from "./research";
import type { ReoptimizationChecklistItem, ReoptimizationHeadingDecision, ReoptimizationStrategy } from "./reoptimization-strategy";
import type { ReoptimizationEvidence, ReoptimizationPageSnapshot } from "./reoptimization-types";

export type { ReoptimizationEvidence, ReoptimizationPageSnapshot } from "./reoptimization-types";

export type ReoptimizationChange = {
  id: string;
  element: string;
  priority: ReoptimizationChecklistItem["priority"];
  current: string;
  recommended: string;
  why: string;
  where: string;
  evidence: ReoptimizationChecklistItem["evidence"];
};

export type ReoptimizationManifest = {
  version: 4;
  id: string;
  auditId: string;
  websiteId: string;
  keyword: string;
  pageUrl: string;
  businessName: string;
  generatedAt: string;
  fetchState: ReoptimizationPageSnapshot["state"];
  warning: string | null;
  evidence: ReoptimizationEvidence;
  research: ReoptimizationResearchResult;
  strategy: ReoptimizationStrategy;
  changes: ReoptimizationChange[];
};

type PageFetchOptions = {
  pageUrl: string;
  websiteUrl: string;
  fetchedAt?: string;
  fetcher?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<string[]>;
};

const tidy = (value: string) => value.replace(/\s+/g, " ").trim();
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const decodeHtml = (value: string) => tidy(value
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&#(\d+);/g, (_, number) => String.fromCharCode(Number(number))));
const normalizedHost = (value: string) => value.toLowerCase().replace(/^www\./, "");

const isPrivateAddress = (address: string) => {
  if (!isIP(address)) return true;
  const lower = address.toLowerCase();
  if (lower === "::1" || lower === "::" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return false;
};

const unverifiedSnapshot = (fetchedAt: string): ReoptimizationPageSnapshot => ({
  state: "unverified", fetchedAt, title: null, metaDescription: null, h1: null, firstParagraph: null, hasFaq: false,
});

export async function fetchReoptimizationPage({ pageUrl, websiteUrl, fetchedAt = new Date().toISOString(), fetcher = fetch, resolveHost = async (hostname) => (await lookup(hostname, { all: true })).map((entry) => entry.address) }: PageFetchOptions): Promise<ReoptimizationPageSnapshot> {
  try {
    const target = new URL(pageUrl);
    const website = new URL(websiteUrl.includes("://") ? websiteUrl : `https://${websiteUrl}`);
    if (!(["http:", "https:"] as string[]).includes(target.protocol) || normalizedHost(target.hostname) !== normalizedHost(website.hostname)) return unverifiedSnapshot(fetchedAt);
    const addresses = await resolveHost(target.hostname);
    if (!addresses.length || addresses.some(isPrivateAddress)) return unverifiedSnapshot(fetchedAt);
    const response = await fetcher(target.toString(), { headers: { Accept: "text/html", "User-Agent": "DestinySEO/1.0 change-document" }, redirect: "error", signal: AbortSignal.timeout(10_000) });
    if (!response.ok || !String(response.headers.get("content-type") || "").toLowerCase().includes("text/html")) return unverifiedSnapshot(fetchedAt);
    const html = (await response.text()).slice(0, 1_000_000);
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
    const meta = html.match(/<meta\b(?=[^>]*\bname\s*=\s*["']description["'])[^>]*\bcontent\s*=\s*["']([^"']*)["'][^>]*>/i)?.[1]
      ?? html.match(/<meta\b(?=[^>]*\bcontent\s*=\s*["']([^"']*)["'])[^>]*\bname\s*=\s*["']description["'][^>]*>/i)?.[1] ?? null;
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? null;
    const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => decodeHtml(match[1])).filter((value) => value.length >= 20);
    return {
      state: "fetched",
      fetchedAt,
      title: title ? decodeHtml(title) : null,
      metaDescription: meta ? decodeHtml(meta) : null,
      h1: h1 ? decodeHtml(h1) : null,
      firstParagraph: paragraphs[0] ?? null,
      hasFaq: /\bFAQPage\b|<h[2-4][^>]*>\s*(?:Frequently asked questions|FAQs?)\s*<\/h[2-4]>/i.test(html),
    };
  } catch {
    return unverifiedSnapshot(fetchedAt);
  }
}

export function buildReoptimizationManifest(evidence: ReoptimizationEvidence, snapshot: ReoptimizationPageSnapshot, research: ReoptimizationResearchResult, strategy: ReoptimizationStrategy, id: string, generatedAt = new Date().toISOString()): ReoptimizationManifest {
  const changes = strategy.checklist.flatMap((item) => item.status === "opportunity" && item.recommended && item.recommended !== "No replacement proposed." ? [{
    id: item.id,
    element: item.action,
    priority: item.priority,
    current: item.current || "No exact current copy was verified; inspect the named location before editing.",
    recommended: item.recommended,
    why: item.finding,
    where: item.where,
    evidence: item.evidence,
  }] : []);
  const currentHeadings = research.currentPage.headingStructure?.length
    ? research.currentPage.headingStructure
    : research.currentPage.headings.map((text, index) => ({ level: index === 0 ? 1 as const : 2 as const, text }));
  const supplied = strategy.headingDecisions ?? [];
  const used = new Set<number>();
  const headingDecisions: ReoptimizationHeadingDecision[] = currentHeadings.map((heading) => {
    const index = supplied.findIndex((decision, candidateIndex) => !used.has(candidateIndex)
      && decision.action !== "add"
      && decision.existingLevel === `H${heading.level}`
      && tidy(decision.existingText).toLowerCase() === tidy(heading.text).toLowerCase());
    if (index >= 0) {
      used.add(index);
      return supplied[index];
    }
    return {
      action: "keep",
      existingLevel: `H${heading.level}` as ReoptimizationHeadingDecision["existingLevel"],
      existingText: heading.text,
      recommendedLevel: `H${heading.level}` as ReoptimizationHeadingDecision["recommendedLevel"],
      recommendedText: heading.text,
      rationale: "No evidence-backed heading change was identified.",
    };
  });
  supplied.forEach((decision, index) => {
    if (decision.action === "add" && !used.has(index)) headingDecisions.push(decision);
  });
  return {
    version: 4,
    id, auditId: evidence.auditId, websiteId: evidence.websiteId, keyword: evidence.keyword, pageUrl: evidence.pageUrl,
    businessName: evidence.businessName, generatedAt, fetchState: snapshot.state,
    warning: snapshot.state === "unverified" ? "Destiny couldn’t independently fetch the live page. DataForSEO evidence may still be present, but verify every current-state reference before editing." : null,
    evidence, research, strategy: { ...strategy, headingDecisions }, changes,
  };
}

const displayKeyword = (value: string) => value.split(/\s+/).map((word) => {
  const normalized = word.toLowerCase();
  if (normalized === "youtube") return "YouTube";
  if (normalized === "seo") return "SEO";
  if (normalized === "ai") return "AI";
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "";
}).join(" ");

const headingWithLevel = (level: string | null, text: string) => level && text ? `${level} — ${text}` : "—";

export function renderReoptimizationWordDocument(manifest: ReoptimizationManifest) {
  const framework = manifest.strategy.keywordFramework;
  const decisions = manifest.strategy.headingDecisions.map((decision) => {
    const recommended = decision.action === "remove" ? decision.rationale : headingWithLevel(decision.recommendedLevel, decision.recommendedText);
    return `<tr><td><strong>${escapeHtml(displayKeyword(decision.action))}</strong></td><td>${escapeHtml(headingWithLevel(decision.existingLevel, decision.existingText))}</td><td>${escapeHtml(recommended)}</td></tr>`;
  }).join("");
  const titleItem = manifest.strategy.checklist.find((item) => item.id === "snippet");
  const currentTitle = manifest.research.currentPage.title || "No verified page title";
  const recommendedTitle = titleItem?.status === "opportunity" && titleItem.recommended && titleItem.recommended !== "No replacement proposed."
    ? titleItem.recommended
    : "Keep the current title unless the final editor-approved heading plan requires a matching update.";
  const otherChanges = manifest.changes.filter((change) => change.id !== "structure" && change.id !== "query-coverage" && change.id !== "snippet");
  const changeCards = otherChanges.map((change) => `<div class="change"><h3>${escapeHtml(change.element)}</h3><p><strong>Before:</strong> ${escapeHtml(change.current)}</p><p><strong>After:</strong> ${escapeHtml(change.recommended)}</p><p><strong>Why:</strong> ${escapeHtml(change.why)}</p></div>`).join("");
  const reviewed = manifest.strategy.headingDecisions.length;
  const counts = manifest.strategy.headingDecisions.reduce((acc, decision) => ({ ...acc, [decision.action]: (acc[decision.action] || 0) + 1 }), {} as Record<string, number>);
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:.65in}body{font-family:Arial,sans-serif;color:#18352e;line-height:1.5;font-size:11pt}h1{font-family:Georgia,serif;font-size:26pt;margin:0 0 8pt}h2{font-family:Georgia,serif;font-size:18pt;margin:24pt 0 8pt}h3{font-size:12pt;margin:0 0 6pt}p{margin:0 0 9pt}.meta{color:#5c6f69;margin-bottom:8pt}.summary{color:#47625a;margin-bottom:18pt}.warning{background:#fff4d6;border:1px solid #e4bd61;padding:10pt}.keyword-map{background:#f1f6f3;border-left:4px solid #2c6b57;padding:11pt;margin:10pt 0 16pt}.keyword-map p{margin:3pt 0}table{border-collapse:collapse;width:100%;margin:10pt 0 18pt;table-layout:fixed}th,td{border:1px solid #dbe4df;padding:7pt;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#183f34;color:white}.heading-table th:first-child,.heading-table td:first-child{width:13%}.heading-table th:nth-child(2),.heading-table td:nth-child(2){width:38%}.heading-table th:nth-child(3),.heading-table td:nth-child(3){width:49%}.change{border:1px solid #dbe4df;border-radius:7px;padding:11pt;margin:0 0 10pt;background:#fafbf9}.next{background:#183f34;color:white;padding:13pt;margin-top:14pt}</style></head><body><h1>Your ${escapeHtml(displayKeyword(manifest.keyword))} Page Update Plan</h1><p class="meta"><strong>${escapeHtml(manifest.businessName)}</strong> · ${escapeHtml(manifest.pageUrl)}</p><p class="summary">This plan shows exactly what to keep, replace, add, remove, or combine. Start at the top of the live page and work downward.</p><p><strong>${reviewed} heading decisions:</strong> Keep ${counts.keep || 0} · Replace ${counts.replace || 0} · Add ${counts.add || 0} · Remove ${counts.remove || 0} · Combine ${counts.combine || 0}</p>${manifest.warning ? `<p class="warning"><strong>Verify before editing:</strong> ${escapeHtml(manifest.warning)}</p>` : ""}<h2>1. Page title</h2><p>Review the title before working on the rest of the page.</p><p><strong>Before:</strong> ${escapeHtml(currentTitle)}</p><p><strong>After:</strong> ${escapeHtml(recommendedTitle)}</p><p><strong>Why:</strong> Keep the primary keyword clear, remove unsupported claims, and make the offer easy to understand.</p><h2>2. Headings</h2><p>Follow the action in the first column. H1, H2, and H3 tell your website editor which heading level to use. The hierarchy distributes the primary keyword, secondary commercial phrases, and related service terms only where they accurately describe the section.</p><div class="keyword-map"><strong>Keyword coverage</strong><p>Primary — ${escapeHtml(framework.primary)}</p><p>Secondary — ${escapeHtml(framework.secondary.join(", ") || "No additional evidence-backed commercial variant")}</p><p>Related — ${escapeHtml(framework.related.join(", ") || "No additional evidence-backed related phrase")}</p></div><table class="heading-table"><thead><tr><th>Action</th><th>Existing heading</th><th>Recommended heading</th></tr></thead><tbody>${decisions || `<tr><td>Verify</td><td>—</td><td>Confirm the live heading structure before editing.</td></tr>`}</tbody></table><h2>3. Other page changes</h2><p>These are the remaining evidence-backed changes that are not heading edits.</p>${changeCards || "<p>No additional page changes are justified yet.</p>"}<h2>4. Your next step</h2><div class="next">Send this document to the person who edits your website. Begin with Section 1, then complete the heading table in page order. Review every claim before changing the CMS; Destiny does not publish automatically.</div></body></html>`;
}
