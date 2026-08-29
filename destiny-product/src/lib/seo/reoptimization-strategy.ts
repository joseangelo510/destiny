import type { ReoptimizationEvidence, ReoptimizationPageSnapshot } from "./reoptimization-document";
import type { ReoptimizationResearchResult } from "./research";
import { normalizeInternalUrl } from "./interlinking";

export const REOPTIMIZATION_CHECKLIST = [
  { id: "decision", label: "Protect, refresh, expand, rewrite, or consolidate" },
  { id: "intent", label: "Search intent and winning page type" },
  { id: "query-coverage", label: "Primary and supporting query coverage" },
  { id: "information-gain", label: "Competitor gaps and information gain" },
  { id: "conversion", label: "Offer clarity and conversion path" },
  { id: "snippet", label: "Title and meta click appeal" },
  { id: "proof", label: "Experience, expertise, proof, and sources" },
  { id: "structure", label: "Structure, readability, and useful media" },
  { id: "internal-links", label: "Internal links and topic cluster" },
  { id: "link-equity", label: "Backlinks and URL equity" },
  { id: "technical", label: "Technical SEO, schema, and performance" },
  { id: "ai-visibility", label: "Answer-engine and AI visibility" },
  { id: "measurement", label: "QA, launch, and measurement" },
] as const;

export type ReoptimizationChecklistId = typeof REOPTIMIZATION_CHECKLIST[number]["id"];
export type ReoptimizationVerdict = "protect" | "light_refresh" | "expand" | "rewrite" | "consolidate";
export type ReoptimizationChecklistItem = {
  id: ReoptimizationChecklistId;
  status: "pass" | "opportunity" | "verify" | "blocked";
  priority: "critical" | "high" | "medium" | "low";
  finding: string;
  action: string;
  current: string;
  recommended: string;
  where: string;
  evidence: Array<{ source: "Current page" | "Website audit" | "DataForSEO SERP" | "DataForSEO OnPage" | "DataForSEO Backlinks" | "Google Search Console"; detail: string; url: string }>;
};

export type ReoptimizationHeadingPlan = {
  summary: string;
  recommended: Array<{
    level: "H1" | "H2" | "H3" | "H4" | "H5" | "H6";
    text: string;
    purpose: string;
    source: "preserved" | "revised" | "new";
  }>;
};

export type ReoptimizationKeywordFramework = {
  primary: string;
  secondary: string[];
  related: string[];
};

export type ReoptimizationHeadingDecision = {
  action: "keep" | "replace" | "add" | "remove" | "combine";
  existingLevel: ReoptimizationHeadingPlan["recommended"][number]["level"] | null;
  existingText: string;
  recommendedLevel: ReoptimizationHeadingPlan["recommended"][number]["level"] | null;
  recommendedText: string;
  rationale: string;
};

export const REOPTIMIZATION_METHOD_SOURCES = [
  {
    name: "Nathan Gotch — complete content upgrade",
    url: "https://www.linkedin.com/posts/nathangotch_the-most-reliable-seo-technique-is-a-complete-activity-7243939984112558080-LBHz",
    principles: "Prioritize an underperforming asset the site can realistically rank for; compare attainable competitors; diagnose intent, strengths, and weaknesses; create differentiated information gain; build a relevant outline; preserve the URL; and add internal links after a substantive upgrade.",
  },
  {
    name: "Neil Patel — updating old content",
    url: "https://neilpatel.com/blog/updating-old-content-to-boost-ranking/",
    principles: "Refresh when information, links, examples, metadata, keyword targeting, or performance have decayed; improve accuracy and firsthand experience; fix broken links; strengthen internal links and the CTA; republish only after a meaningful update; then monitor clicks, impressions, rankings, and the page's keyword universe.",
  },
] as const;

export type ReoptimizationStrategy = {
  verdict: ReoptimizationVerdict;
  verdictLabel: string;
  summary: string;
  primaryGoal: string;
  preserve: string[];
  keywordFramework: ReoptimizationKeywordFramework;
  headingPlan: ReoptimizationHeadingPlan;
  headingDecisions: ReoptimizationHeadingDecision[];
  checklist: ReoptimizationChecklistItem[];
  measurementPlan: string[];
};

type VerifiedInternalPage = { title: string; url: string; text?: string };

const clean = (value: unknown, maximum = 5_000) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function linkTerms(value: string) {
  const stop = new Set(["about", "agency", "and", "best", "company", "for", "from", "guide", "home", "page", "services", "the", "this", "with", "your"]);
  return [...new Set(value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((term) => term.length > 2 && !stop.has(term)))];
}

export function applyVerifiedInternalLinkPlan(strategy: ReoptimizationStrategy, pages: VerifiedInternalPage[], targetUrl: string, currentText: string) {
  const target = normalizeInternalUrl(targetUrl, targetUrl);
  const signal = linkTerms([strategy.keywordFramework.primary, ...strategy.keywordFramework.secondary, ...strategy.keywordFramework.related, currentText.slice(0, 8_000)].join(" "));
  const seen = new Set<string>();
  const relevant = pages.flatMap((page) => {
    const url = normalizeInternalUrl(page.url, targetUrl);
    if (!url || url === target || seen.has(url)) return [];
    seen.add(url);
    const haystack = `${page.title} ${page.text ?? ""}`.toLocaleLowerCase();
    const score = signal.filter((term) => haystack.includes(term)).length;
    return score > 0 ? [{ ...page, url, score }] : [];
  }).sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)).slice(0, 3);
  const internalLinkItem = strategy.checklist.find((item) => item.id === "internal-links");
  if (!internalLinkItem) return strategy;
  const replacement: ReoptimizationChecklistItem = relevant.length ? {
    ...internalLinkItem,
    status: "opportunity",
    priority: relevant.length >= 3 ? "high" : "medium",
    finding: `${relevant.length} relevant internal destination${relevant.length === 1 ? " was" : "s were"} verified for this page update.`,
    action: relevant.length >= 3 ? "Add these three internal links during the page update." : `Add the ${relevant.length} relevant verified link${relevant.length === 1 ? "" : "s"}; do not invent extra destinations to reach three.`,
    current: `${internalLinkItem.current} Verify the live page before removing or replacing any existing link.`,
    recommended: relevant.map((page, index) => `${index + 1}. Link “${page.title}” to ${page.url}`).join("\n"),
    where: "Place each link in the section where it genuinely helps the reader; do not stack the links into one paragraph.",
    evidence: relevant.map((page) => ({ source: "Website audit" as const, detail: `Verified internal destination: ${page.title}`, url: page.url })),
  } : {
    ...internalLinkItem,
    status: "verify",
    priority: "medium",
    finding: "Rebound SEO did not find a relevant verified destination in the current page inventory.",
    action: "Run Internal links or a fresh website audit before adding links to this page.",
    recommended: "No internal URL proposed; inventing a destination is blocked.",
    where: "No CMS edit until a relevant destination is verified.",
    evidence: [{ source: "Current page" as const, detail: "No relevant verified internal destination was supplied.", url: targetUrl }],
  };
  return { ...strategy, checklist: strategy.checklist.map((item) => item.id === "internal-links" ? replacement : item) };
}

export function buildReoptimizationEvidencePack(evidence: ReoptimizationEvidence, snapshot: ReoptimizationPageSnapshot, research: ReoptimizationResearchResult, verifiedInternalPages: VerifiedInternalPage[] = []) {
  const competitors = research.competitorPages.map((page) => ({ rank: page.rank, title: page.title, url: page.url, headings: page.headingStructure, wordCount: page.wordCount, backlinkRank: page.backlinkRank, referringDomains: page.referringDomains, excerpt: page.text.slice(0, 5_000) }));
  return JSON.stringify({
    business: { name: evidence.businessName, productsServices: evidence.productsServices, idealCustomer: evidence.idealCustomer },
    target: { keyword: evidence.keyword, pageUrl: evidence.pageUrl, monthlySearches: evidence.searchVolume, observedRank: evidence.rank, gscPosition: evidence.gscPosition, gscImpressions: evidence.gscImpressions, gscClicks: evidence.gscClicks },
    livePage: {
      fetchState: snapshot.state,
      fetchedAt: snapshot.fetchedAt,
      title: research.currentPage.title || snapshot.title,
      metaDescription: research.currentPage.description || snapshot.metaDescription,
      h1: snapshot.h1,
      headings: research.currentPage.headingStructure,
      wordCount: research.currentPage.wordCount,
      text: research.currentPage.text.slice(0, 16_000),
      outboundAndInternalLinks: research.currentPage.links.slice(0, 60),
    },
    searchResults: research.serp,
    pageKeywordUniverse: research.queries.currentRankings,
    relatedQueryOpportunities: research.queries.related,
    competitorPages: competitors,
    onPage: research.onPage,
    backlinks: research.backlinks,
    verifiedInternalPages: verifiedInternalPages.slice(0, 25),
    researchUpdatedAt: research.updatedAt,
  }, null, 2);
}

export function buildReoptimizationPrompt(evidencePack: string) {
  const required = REOPTIMIZATION_CHECKLIST.map((item) => `${item.id}: ${item.label}`).join("\n");
  const methods = REOPTIMIZATION_METHOD_SOURCES.map((source) => `- ${source.name}: ${source.principles} Source: ${source.url}`).join("\n");
  return `You are Rebound SEO's senior SEO re-optimization analyst. Do not imitate or claim to be any living marketer. Apply an original, evidence-first synthesis of the following public methods as decision gates, not as decorative name-dropping:

${methods}

Nathan Gotch's public content-upgrade sequence must influence asset selection, realistic ranking feasibility, attainable-competitor comparison, intent diagnosis, differentiation, outline quality, URL preservation, substantive republishing, and internal-link follow-through. Neil Patel's public content-refresh guidance must influence decay diagnosis, accuracy, freshness, broken-link review, metadata and keyword realignment, first-hand experience, internal links, CTA relevance, republishing discipline, and post-change monitoring.

Use only the supplied evidence. Never invent current copy, rankings, backlinks, traffic, competitors, page features, or performance. If evidence cannot support a specific change, set status to "verify" and say what must be checked. Do not recommend a new title, H1, FAQ, word count, or rewrite merely because it is conventional. A service page must remain a service page when the SERP supports that intent. Preserve the existing URL unless consolidation is explicitly supported. Flag claims that require proof rather than automatically deleting them. Existing FAQ or proof sections must be evaluated before proposing additions.

First decide one verdict:
- protect: already winning; make only defensive freshness/CTR/accuracy changes
- light_refresh: structurally sound; improve a small number of evidence-backed elements
- expand: correct page and intent, but meaningful competitor/query/conversion gaps exist
- rewrite: the page substantially misses intent or is unusable; preserve URL and valuable material
- consolidate: multiple pages split the same intent; merge carefully and redirect only after validation

For each checklist category, return exactly one item. A recommendation must be concrete enough to implement. Put exact replacement copy in "recommended" only when the evidence supports it; otherwise describe the edit or use "No replacement proposed." Put exact current text in "current" only if it appears in the supplied live-page evidence. Every opportunity must cite at least one evidence object. Every item must explain where the change belongs.

Heading hierarchy and keyword coverage are required first-class outputs.

Build keywordFramework from supplied query evidence:
- Primary phrase: use the supplied target keyword. It should anchor the title/H1 when that is accurate for the page and supported by the evidence.
- Secondary phrases: select close commercial variants that express the same service or buying intent, such as “YouTube Advertising Agency,” “YouTube Ad Agency,” or “YouTube Ads Services.”
- Related phrases: select evidence-backed service components, problems, or subtopics that belong naturally within specific sections, such as strategy, video production, campaign management, media buying, testing, reporting, or optimization.
- Do not remove a relevant variant merely because it resembles the primary keyword. Use H2 and H3 headings to cover accurate secondary and related phrases naturally. Do not stuff the same phrase repeatedly, force an unrelated term into a heading, or invent search demand. DataForSEO current rankings, related queries, SERP language, and the actual offer are the evidence boundary.

Read livePage.headings as the verified current H1-H6 sequence. Do not flatten it, rename it silently, or infer missing levels. In headingPlan, summarize the structural problem and return the complete proposed H1-H6 outline in reading order—not merely the headings that change. Label every proposed heading as preserved, revised, or new. Use one H1. Nest lower-level headings beneath a relevant parent. Do not promote card titles, portfolio items, or repeated service details to peer H2s merely for styling. Do not invent a heading solely to repeat a keyword. If the supplied page has no verified heading levels, return an empty proposed outline and explain that the structure must be verified.

Return one heading decision for every verified current heading, in its original reading order, plus separate “add” decisions for genuinely new headings. Each decision must say keep, replace, remove, combine, or add; retain the exact existing level and text when one exists; provide the exact recommended level and text when one exists; and give a short rationale. A related phrase can justify a revised H2 or H3 only when that phrase accurately describes the section. Never silently omit an existing heading.

Required checklist, in this exact order:
${required}

Apply these gates rigorously:
1. Decision: weigh the current rank/query universe, GSC impressions and clicks, backlink equity, intent match, and possible cannibalization. Do not prescribe a rewrite when a focused expansion or light refresh is safer.
2. Intent: infer the dominant intent and page type from the live top results. Match the job searchers are trying to complete, not just the keyword string.
3. Query coverage: separate the focus query from natural supporting queries the same page can satisfy. Do not stuff variants or mix unrelated intents.
4. Information gain: compare actual competitor headings and substance, then recommend only gaps that improve the user's decision. Use DataForSEO backlinkRank and referringDomains to prioritize attainable competitors with authority reasonably close to the target page; do not treat the strongest domain as the only model. If comparable-authority evidence is missing, mark the comparison for verification. Never copy a competitor's structure wholesale.
5. Conversion: for commercial or transactional pages, inspect offer clarity, audience fit, process, proof, objections, next step, and CTA continuity. Recommend a conversion change only when page evidence supports the gap.
6. Snippet: protect a title/meta that already matches intent. Recommend exact alternatives only when the current snippet is missing, stale, misleading, truncated, or weak relative to the SERP.
7. Proof: verify claims, dates, examples, author/company experience, case evidence, citations, and trust signals. Mark unsupported superlatives for substantiation.
8. Structure: compare the exact current and proposed heading hierarchies; improve scanability, heading logic, accuracy, dated material, broken references, visuals, and accessibility. Never pad to an arbitrary word count.
9. Internal links: use only verifiedInternalPages and verified live-page links. Recommend at least three relevant internal links when three or more genuinely related verified pages are available. Name the exact destination URL and natural anchor. If fewer than three relevant verified pages exist, use every relevant verified page and explain the shortfall instead of inventing URLs, anchors, or relevance.
10. Link equity: preserve the URL and linked material. A merge or redirect requires explicit evidence and a redirect/canonical plan.
11. Technical: interpret DataForSEO OnPage output, but distinguish raw checks from confirmed faults. Include schema or performance work only when relevant and verified.
12. AI visibility: make key answers explicit, quotable, attributable, and supported by first-party evidence; do not create generic FAQ filler.
13. Measurement: specify what changed, baseline metrics, annotation, reindexing when appropriate, and review windows. Never promise a ranking outcome.

Before recommending republishing or changing the visible updated date, require a substantive improvement to intent satisfaction, accuracy, evidence, or usefulness. A date-only freshness change is never a recommendation.

Measurement must include a pre-change baseline, annotation/date, reindexing when appropriate, and review windows at roughly 14, 30, and 60 days without promising rankings.

EVIDENCE PACK
${evidencePack}`;
}

const evidenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["source", "detail", "url"],
  properties: {
    source: { type: "string", enum: ["Current page", "Website audit", "DataForSEO SERP", "DataForSEO OnPage", "DataForSEO Backlinks", "Google Search Console"] },
    detail: { type: "string" },
    url: { type: "string" },
  },
};

export function buildAnthropicReoptimizationRequest(prompt: string, model: string) {
  return {
    model,
    max_tokens: 8_000,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["verdict", "verdictLabel", "summary", "primaryGoal", "preserve", "keywordFramework", "headingPlan", "headingDecisions", "checklist", "measurementPlan"],
          properties: {
            verdict: { type: "string", enum: ["protect", "light_refresh", "expand", "rewrite", "consolidate"] },
            verdictLabel: { type: "string" },
            summary: { type: "string" },
            primaryGoal: { type: "string" },
            preserve: { type: "array", items: { type: "string" } },
            keywordFramework: {
              type: "object",
              additionalProperties: false,
              required: ["primary", "secondary", "related"],
              properties: {
                primary: { type: "string" },
                secondary: { type: "array", maxItems: 12, items: { type: "string" } },
                related: { type: "array", maxItems: 20, items: { type: "string" } },
              },
            },
            headingPlan: {
              type: "object",
              additionalProperties: false,
              required: ["summary", "recommended"],
              properties: {
                summary: { type: "string" },
                recommended: {
                  type: "array",
                  maxItems: 80,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["level", "text", "purpose", "source"],
                    properties: {
                      level: { type: "string", enum: ["H1", "H2", "H3", "H4", "H5", "H6"] },
                      text: { type: "string" },
                      purpose: { type: "string" },
                      source: { type: "string", enum: ["preserved", "revised", "new"] },
                    },
                  },
                },
              },
            },
            headingDecisions: {
              type: "array",
              maxItems: 120,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["action", "existingLevel", "existingText", "recommendedLevel", "recommendedText", "rationale"],
                properties: {
                  action: { type: "string", enum: ["keep", "replace", "add", "remove", "combine"] },
                  existingLevel: { type: ["string", "null"], enum: ["H1", "H2", "H3", "H4", "H5", "H6", null] },
                  existingText: { type: "string" },
                  recommendedLevel: { type: ["string", "null"], enum: ["H1", "H2", "H3", "H4", "H5", "H6", null] },
                  recommendedText: { type: "string" },
                  rationale: { type: "string" },
                },
              },
            },
            checklist: {
              type: "array",
              minItems: REOPTIMIZATION_CHECKLIST.length,
              maxItems: REOPTIMIZATION_CHECKLIST.length,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "status", "priority", "finding", "action", "current", "recommended", "where", "evidence"],
                properties: {
                  id: { type: "string", enum: REOPTIMIZATION_CHECKLIST.map((item) => item.id) },
                  status: { type: "string", enum: ["pass", "opportunity", "verify", "blocked"] },
                  priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  finding: { type: "string" },
                  action: { type: "string" },
                  current: { type: "string" },
                  recommended: { type: "string" },
                  where: { type: "string" },
                  evidence: { type: "array", items: evidenceSchema },
                },
              },
            },
            measurementPlan: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    messages: [{ role: "user", content: prompt }],
  };
}

export function parseReoptimizationStrategy(value: unknown): ReoptimizationStrategy {
  const root = typeof value === "string" ? record(JSON.parse(value)) : record(value);
  const verdicts = new Set<ReoptimizationVerdict>(["protect", "light_refresh", "expand", "rewrite", "consolidate"]);
  const verdict = clean(root.verdict) as ReoptimizationVerdict;
  if (!verdicts.has(verdict)) throw new Error("The re-optimization analysis did not return a valid page decision.");
  const suppliedItems = Array.isArray(root.checklist) ? root.checklist.map(record) : [];
  const byId = new Map(suppliedItems.map((item) => [clean(item.id), item]));
  const checklist = REOPTIMIZATION_CHECKLIST.map(({ id }) => {
    const item = byId.get(id);
    if (!item) throw new Error(`The re-optimization analysis omitted the ${id} checklist gate.`);
    const status = clean(item.status) as ReoptimizationChecklistItem["status"];
    const priority = clean(item.priority) as ReoptimizationChecklistItem["priority"];
    if (!["pass", "opportunity", "verify", "blocked"].includes(status)) throw new Error(`Invalid status for ${id}.`);
    if (!["critical", "high", "medium", "low"].includes(priority)) throw new Error(`Invalid priority for ${id}.`);
    const evidence = Array.isArray(item.evidence) ? item.evidence.map(record).map((source) => ({
      source: clean(source.source) as ReoptimizationChecklistItem["evidence"][number]["source"],
      detail: clean(source.detail),
      url: clean(source.url, 2_048),
    })).filter((source) => source.source && source.detail) : [];
    if ((status === "opportunity" || status === "pass") && !evidence.length) throw new Error(`${id} is missing supporting evidence.`);
    return { id, status, priority, finding: clean(item.finding), action: clean(item.action), current: clean(item.current), recommended: clean(item.recommended), where: clean(item.where), evidence };
  });
  const headingPlanRoot = record(root.headingPlan);
  const recommendedHeadings = Array.isArray(headingPlanRoot.recommended) ? headingPlanRoot.recommended.map(record).map((heading) => ({
    level: clean(heading.level) as ReoptimizationHeadingPlan["recommended"][number]["level"],
    text: clean(heading.text),
    purpose: clean(heading.purpose),
    source: clean(heading.source) as ReoptimizationHeadingPlan["recommended"][number]["source"],
  })).filter((heading) => ["H1", "H2", "H3", "H4", "H5", "H6"].includes(heading.level) && heading.text && heading.purpose && ["preserved", "revised", "new"].includes(heading.source)) : [];
  if (recommendedHeadings.length && recommendedHeadings.filter((heading) => heading.level === "H1").length !== 1) throw new Error("The re-optimization heading plan must contain exactly one H1.");
  const keywordRoot = record(root.keywordFramework);
  const primary = clean(keywordRoot.primary, 200);
  if (!primary) throw new Error("The re-optimization analysis did not return a primary keyword.");
  const normalizedPrimary = primary.toLowerCase();
  const keywordList = (value: unknown, exclude: Set<string>) => {
    const seen = new Set(exclude);
    return (Array.isArray(value) ? value : []).map((item) => clean(item, 200)).filter((item) => {
      const normalized = item.toLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  };
  const secondary = keywordList(keywordRoot.secondary, new Set([normalizedPrimary])).slice(0, 12);
  const related = keywordList(keywordRoot.related, new Set([normalizedPrimary, ...secondary.map((item) => item.toLowerCase())])).slice(0, 20);
  const validLevels = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
  const headingDecisions = (Array.isArray(root.headingDecisions) ? root.headingDecisions : []).map(record).flatMap((decision) => {
    const action = clean(decision.action) as ReoptimizationHeadingDecision["action"];
    const existingLevelValue = clean(decision.existingLevel);
    const recommendedLevelValue = clean(decision.recommendedLevel);
    const existingLevel = validLevels.has(existingLevelValue) ? existingLevelValue as ReoptimizationHeadingDecision["existingLevel"] : null;
    const recommendedLevel = validLevels.has(recommendedLevelValue) ? recommendedLevelValue as ReoptimizationHeadingDecision["recommendedLevel"] : null;
    const existingText = clean(decision.existingText, 500);
    const recommendedText = clean(decision.recommendedText, 500);
    const rationale = clean(decision.rationale, 1_000);
    if (!["keep", "replace", "add", "remove", "combine"].includes(action)) return [];
    if (action === "add" && (!recommendedLevel || !recommendedText)) return [];
    if (action !== "add" && (!existingLevel || !existingText)) return [];
    if (["keep", "replace", "combine"].includes(action) && (!recommendedLevel || !recommendedText)) return [];
    return [{ action, existingLevel, existingText, recommendedLevel, recommendedText, rationale }];
  });
  return {
    verdict,
    verdictLabel: clean(root.verdictLabel),
    summary: clean(root.summary),
    primaryGoal: clean(root.primaryGoal),
    preserve: Array.isArray(root.preserve) ? root.preserve.map((item) => clean(item)).filter(Boolean) : [],
    keywordFramework: { primary, secondary, related },
    headingPlan: { summary: clean(headingPlanRoot.summary), recommended: recommendedHeadings },
    headingDecisions,
    checklist,
    measurementPlan: Array.isArray(root.measurementPlan) ? root.measurementPlan.map((item) => clean(item)).filter(Boolean) : [],
  };
}
