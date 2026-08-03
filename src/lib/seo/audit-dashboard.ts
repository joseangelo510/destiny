export type AuditSeverity = "critical" | "warning";

export type AuditCategoryId =
  | "crawl-indexing"
  | "metadata-content"
  | "links-redirects"
  | "mobile-performance"
  | "https-security"
  | "structured-data"
  | "other-technical";

export type AuditIssueInput = {
  code: string;
  label: string;
  severity: AuditSeverity;
};

export type AuditIssueView = AuditIssueInput & {
  affectedPages: string[];
  category: AuditCategoryId;
  categoryLabel: string;
  nextAction: string;
  whyItMatters: string;
};

type CategoryDefinition = {
  id: AuditCategoryId;
  label: string;
  description: string;
};

export const AUDIT_CATEGORIES: CategoryDefinition[] = [
  { id: "crawl-indexing", label: "Crawl & indexing", description: "Can search engines reach and understand the page?" },
  { id: "metadata-content", label: "Metadata & content", description: "Does the page clearly explain what it offers?" },
  { id: "links-redirects", label: "Links & redirects", description: "Do links and destination signals lead somewhere useful?" },
  { id: "mobile-performance", label: "Mobile & performance", description: "Can visitors load and use the page without friction?" },
  { id: "https-security", label: "HTTPS & security", description: "Does the page use the basic secure web standard?" },
  { id: "structured-data", label: "Structured data", description: "Can search engines interpret enhanced page details?" },
  { id: "other-technical", label: "Other technical", description: "Additional checks that support a healthy site." },
];

const CATEGORY_BY_CODE: Record<string, AuditCategoryId> = {
  canonical_to_broken: "links-redirects",
  canonical_to_redirect: "links-redirects",
  broken_links: "links-redirects",
  has_meta_refresh_redirect: "links-redirects",
  has_redirect: "links-redirects",
  is_4xx_code: "crawl-indexing",
  is_5xx_code: "crawl-indexing",
  is_broken: "crawl-indexing",
  no_doctype: "crawl-indexing",
  no_content: "metadata-content",
  deprecated_html_tags: "metadata-content",
  duplicate_meta_tags: "metadata-content",
  duplicate_title_tag: "metadata-content",
  irrelevant_description: "metadata-content",
  irrelevant_title: "metadata-content",
  low_character_count: "metadata-content",
  low_content_rate: "metadata-content",
  low_readability_rate: "metadata-content",
  no_description: "metadata-content",
  no_h1_tag: "metadata-content",
  no_image_alt: "metadata-content",
  no_image_title: "metadata-content",
  no_title: "metadata-content",
  small_page_size: "metadata-content",
  thin_content: "metadata-content",
  title_too_long: "metadata-content",
  title_too_short: "metadata-content",
  has_render_blocking_resources: "mobile-performance",
  high_loading_time: "mobile-performance",
  high_waiting_time: "mobile-performance",
  large_page_size: "mobile-performance",
  no_content_encoding: "mobile-performance",
  is_http: "https-security",
  has_micromarkup_errors: "structured-data",
};

const GUIDANCE_BY_CODE: Record<string, { whyItMatters: string; nextAction: string }> = {
  no_title: {
    whyItMatters: "The page has no clear search-result headline, so people and search engines may not understand its purpose.",
    nextAction: "Add one specific page title that describes the primary service or topic.",
  },
  no_description: {
    whyItMatters: "A missing description leaves search engines to choose unclear preview copy for the result.",
    nextAction: "Write a concise description that explains the page benefit and invites the right visitor to click.",
  },
  no_h1_tag: {
    whyItMatters: "The page is missing its main visible heading, which weakens structure for visitors and search engines.",
    nextAction: "Add one clear H1 that states the page’s main topic in plain language.",
  },
  broken_links: {
    whyItMatters: "Broken links interrupt visitors and stop search engines from following the intended path.",
    nextAction: "Repair, replace, or remove each broken destination, then run the audit again.",
  },
  high_loading_time: {
    whyItMatters: "Slow pages lose visitors and can reduce search performance, especially on mobile connections.",
    nextAction: "Run PageSpeed Insights, then address the largest image, script, or server-delay opportunity first.",
  },
  high_waiting_time: {
    whyItMatters: "The server takes too long to begin responding, delaying everything visitors see afterward.",
    nextAction: "Review hosting, caching, database work, and server-side redirects with your developer or host.",
  },
  is_http: {
    whyItMatters: "Visitors and browsers cannot confirm that information sent to this page is protected.",
    nextAction: "Enable HTTPS, redirect the HTTP version, and update internal links to the secure URL.",
  },
  has_micromarkup_errors: {
    whyItMatters: "Invalid structured data can prevent enhanced search-result features from appearing.",
    nextAction: "Validate the page in Google’s Rich Results Test and correct the first reported schema error.",
  },
  is_4xx_code: {
    whyItMatters: "The page tells visitors and search engines that the requested content is unavailable.",
    nextAction: "Restore the page or redirect it to the closest relevant live destination.",
  },
  is_5xx_code: {
    whyItMatters: "A server error prevents both visitors and search engines from accessing the page.",
    nextAction: "Check hosting and application logs, restore the page, and rerun the audit after it returns normally.",
  },
};

const DEFAULT_GUIDANCE: Record<AuditCategoryId, { whyItMatters: string; nextAction: string }> = {
  "crawl-indexing": {
    whyItMatters: "This can prevent search engines from reliably reaching, interpreting, or keeping the page in search results.",
    nextAction: "Open the affected page, correct the crawl or response signal, then rerun the audit to verify it.",
  },
  "metadata-content": {
    whyItMatters: "Unclear page structure makes it harder for visitors and search engines to understand the page.",
    nextAction: "Clarify the flagged title, heading, description, image text, or body content on the affected page.",
  },
  "links-redirects": {
    whyItMatters: "Conflicting links or redirects can send visitors and search engines to the wrong destination.",
    nextAction: "Choose the intended final URL, repair the path, and remove unnecessary redirect steps.",
  },
  "mobile-performance": {
    whyItMatters: "Heavy or slow pages create friction for visitors and can weaken organic performance.",
    nextAction: "Use PageSpeed Insights to identify the largest bottleneck and fix one high-impact item first.",
  },
  "https-security": {
    whyItMatters: "Basic security problems can reduce visitor trust and create browser warnings.",
    nextAction: "Correct the HTTPS configuration and confirm every public page loads securely.",
  },
  "structured-data": {
    whyItMatters: "Search engines may not be able to use the page’s enhanced structured information.",
    nextAction: "Validate the markup, correct required properties, and test the page again.",
  },
  "other-technical": {
    whyItMatters: "This technical signal can make the page less reliable for visitors or search engines.",
    nextAction: "Review the affected page, correct the flagged condition, and verify it with a fresh audit.",
  },
};

function normalizeScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(Math.max(0, Math.min(100, value)));
}

function healthLabel(score: number | null) {
  if (score === null) return "Score unavailable";
  if (score >= 90) return "Excellent foundation";
  if (score >= 75) return "Good foundation";
  if (score >= 50) return "Needs attention";
  return "At risk";
}

export function issueCategory(code: string) {
  return CATEGORY_BY_CODE[code] ?? "other-technical";
}

export function buildAuditDashboard(input: {
  healthScore: number | null;
  inspectedPages: number;
  inspectedUrl: string;
  measuredCritical: number;
  measuredWarnings: number;
  issues: AuditIssueInput[];
}) {
  const categoryDefinitions = new Map(AUDIT_CATEGORIES.map((category) => [category.id, category]));
  const issues: AuditIssueView[] = input.issues.map((issue) => {
    const category = issueCategory(issue.code);
    const guidance = GUIDANCE_BY_CODE[issue.code] ?? DEFAULT_GUIDANCE[category];
    return {
      ...issue,
      affectedPages: input.inspectedUrl ? [input.inspectedUrl] : [],
      category,
      categoryLabel: categoryDefinitions.get(category)?.label ?? "Other technical",
      ...guidance,
    };
  }).sort((left, right) => Number(right.severity === "critical") - Number(left.severity === "critical"));
  const score = normalizeScore(input.healthScore);
  const issueTotal = Math.max(0, input.measuredCritical) + Math.max(0, input.measuredWarnings);
  const categories = AUDIT_CATEGORIES.map((category) => {
    const matching = issues.filter((issue) => issue.category === category.id);
    return {
      ...category,
      critical: matching.filter((issue) => issue.severity === "critical").length,
      warnings: matching.filter((issue) => issue.severity === "warning").length,
      total: matching.length,
    };
  });

  return {
    categories,
    coverageLabel: `Initial coverage: homepage technical scan${input.inspectedPages > 0 ? ` + ${input.inspectedPages} strategic page${input.inspectedPages === 1 ? "" : "s"} reviewed for business relevance` : ""}.`,
    healthLabel: healthLabel(score),
    healthScore: score,
    isPartial: issueTotal > issues.length,
    issueTotal,
    issues,
    priorityIssues: issues.slice(0, 3),
    priorityIssue: issues[0] ?? null,
  };
}
