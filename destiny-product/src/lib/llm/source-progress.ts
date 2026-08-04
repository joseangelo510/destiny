export type LlmSourceKey =
  | "owned-site"
  | "reddit"
  | "youtube"
  | "linkedin"
  | "quora"
  | "reviews"
  | "earned-media"
  | "wikipedia"
  | "medium";

export type LlmTaskStatus = "todo" | "complete";

export type LlmSourceTask = {
  key: string;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  requiresProof?: boolean;
  proofLabel?: string;
  proofPlaceholder?: string;
  proofHostnames?: readonly string[];
};

export type LlmSourcePlaybook = {
  key: LlmSourceKey;
  name: string;
  domain: string;
  category: "foundation" | "participatory" | "earned";
  summary: string;
  expectation: string;
  tasks: readonly LlmSourceTask[];
};

export const AI_ENGINE_CITATION_SNAPSHOTS = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    updated: "July 2026",
    dataAsOf: "July 2026",
    sourceUrl: "https://ahrefs.com/blog/most-cited-domains-in-chatgpt/",
    domains: [
      { domain: "reddit.com", label: "Reddit", share: 16.7 },
      { domain: "wikipedia.org", label: "Wikipedia", share: 8.9 },
      { domain: "forbes.com", label: "Forbes", share: 3.3 },
      { domain: "youtube.com", label: "YouTube", share: 1.8 },
      { domain: "linkedin.com", label: "LinkedIn", share: 0.9 },
    ],
  },
  {
    id: "gemini",
    label: "Gemini",
    updated: "July 2026",
    dataAsOf: "June 2026",
    sourceUrl: "https://ahrefs.com/blog/most-cited-domains-gemini/",
    domains: [
      { domain: "reddit.com", label: "Reddit", share: 29.2 },
      { domain: "youtube.com", label: "YouTube", share: 13.9 },
      { domain: "wikipedia.org", label: "Wikipedia", share: 12.1 },
    ],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    updated: "July 2026",
    dataAsOf: "July 2026",
    sourceUrl: "https://ahrefs.com/blog/most-cited-domains-perplexity/",
    domains: [
      { domain: "youtube.com", label: "YouTube", share: 31.2 },
      { domain: "reddit.com", label: "Reddit", share: 13.9 },
      { domain: "wikipedia.org", label: "Wikipedia", share: 7.2 },
      { domain: "linkedin.com", label: "LinkedIn", share: 1.1 },
      { domain: "medium.com", label: "Medium", share: 0.7 },
    ],
  },
  {
    id: "google-ai-mode",
    label: "Google AI Mode",
    updated: "July 2026",
    dataAsOf: "July 2026",
    sourceUrl: "https://ahrefs.com/blog/most-cited-domains-ai-mode/",
    domains: [
      { domain: "reddit.com", label: "Reddit", share: 19.9 },
      { domain: "youtube.com", label: "YouTube", share: 17 },
      { domain: "google.com", label: "Google", share: 11.5 },
      { domain: "wikipedia.org", label: "Wikipedia", share: 4.9 },
      { domain: "quora.com", label: "Quora", share: 2.6 },
    ],
  },
  {
    id: "google-ai-overviews",
    label: "Google AI Overviews",
    updated: "July 2026",
    dataAsOf: "July 2026",
    sourceUrl: "https://ahrefs.com/blog/most-cited-domains-ai-overviews/",
    domains: [
      { domain: "youtube.com", label: "YouTube", share: 21.1 },
      { domain: "reddit.com", label: "Reddit", share: 18.5 },
      { domain: "quora.com", label: "Quora", share: 5 },
      { domain: "wikipedia.org", label: "Wikipedia", share: 4.8 },
    ],
  },
] as const;

export const LLM_SOURCE_PLAYBOOKS: readonly LlmSourcePlaybook[] = [
  {
    key: "owned-site",
    name: "Your website",
    domain: "Owned foundation",
    category: "foundation",
    summary: "Make the business, people, services, and proof easy for search and answer engines to understand.",
    expectation: "You control this work. It improves source readiness but does not guarantee an AI citation.",
    tasks: [
      { key: "clarify-entity", title: "Clarify the business entity", description: "Review the homepage, About, service, contact, and author information so the same business facts appear consistently.", actionHref: "/content", actionLabel: "Review content" },
      { key: "publish-source-page", title: "Publish one source-worthy answer", description: "Answer a high-value buyer question with original experience, examples, evidence, and cited primary sources.", actionHref: "/content", actionLabel: "Create answer", requiresProof: true, proofLabel: "Published page URL", proofPlaceholder: "https://yourwebsite.com/helpful-answer" },
      { key: "make-discoverable", title: "Make the answer discoverable", description: "Add descriptive headings, internal links, author context, structured data where appropriate, and confirm the page can be crawled.", actionHref: "/audits", actionLabel: "Review audit" },
    ],
  },
  {
    key: "reddit",
    name: "Reddit",
    domain: "reddit.com",
    category: "participatory",
    summary: "Contribute first-hand expertise where customers already discuss the problem.",
    expectation: "Help first. Follow community rules, disclose affiliation, and link only when it materially helps the reader.",
    tasks: [
      { key: "find-conversations", title: "Find relevant live conversations", description: "Choose threads where the business has specific, first-hand knowledge and the question is still useful to answer.", actionHref: "/distribution#community", actionLabel: "Find threads" },
      { key: "write-helpful-answer", title: "Write a help-first answer", description: "Answer the question completely, disclose your connection to the business, and avoid promotional or repeated posting.", actionHref: "/distribution#community", actionLabel: "Draft answer" },
      { key: "save-live-answer", title: "Publish and save the live answer", description: "Post only after review, then record the exact public URL so referral traffic and later citation evidence can be monitored.", actionHref: "/distribution#community", actionLabel: "Open distribution", requiresProof: true, proofLabel: "Reddit answer URL", proofPlaceholder: "https://www.reddit.com/r/.../comments/...", proofHostnames: ["reddit.com"] },
    ],
  },
  {
    key: "youtube",
    name: "YouTube",
    domain: "youtube.com",
    category: "participatory",
    summary: "Turn customer questions into useful, searchable video explanations.",
    expectation: "Publishing creates a discoverable source. Destiny only calls it AI visibility when separate provider evidence detects a mention or citation.",
    tasks: [
      { key: "choose-question", title: "Choose one buyer question", description: "Select a decision-stage question customers repeatedly ask and outline a direct, experience-based answer.", actionHref: "/content", actionLabel: "Choose topic" },
      { key: "publish-video", title: "Publish an answer-first video", description: "Use a descriptive title and opening, add chapters, accurate captions or a transcript, a useful description, and links to cited sources.", actionHref: "/integrations", actionLabel: "Connect YouTube", requiresProof: true, proofLabel: "YouTube public URL", proofPlaceholder: "https://www.youtube.com/watch?v=...", proofHostnames: ["youtube.com", "youtu.be"] },
      { key: "embed-video", title: "Embed the video with its answer", description: "Embed the finished video on a relevant crawlable page and include a readable transcript or summary with supporting evidence.", actionHref: "/content", actionLabel: "Open content" },
    ],
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    domain: "linkedin.com",
    category: "participatory",
    summary: "Build a consistent expert and company presence around the problems the business solves.",
    expectation: "Relevance, originality, and consistent expertise matter more than chasing a viral post.",
    tasks: [
      { key: "complete-presence", title: "Complete the expert and company presence", description: "Align the founder profile and Company Page with accurate services, expertise, proof, and website links.", actionHref: "/distribution", actionLabel: "Open distribution" },
      { key: "publish-expert-post", title: "Publish an original expert post", description: "Explain one customer problem with a clear point of view, first-hand detail, and a useful example or source.", actionHref: "/distribution", actionLabel: "Draft post", requiresProof: true, proofLabel: "LinkedIn post URL", proofPlaceholder: "https://www.linkedin.com/posts/...", proofHostnames: ["linkedin.com"] },
      { key: "sustain-topic", title: "Build a consistent topic trail", description: "Publish and engage around the same core topic over several weeks so expertise is coherent rather than isolated.", actionHref: "/growth-plan", actionLabel: "View plan" },
    ],
  },
  {
    key: "quora",
    name: "Quora",
    domain: "quora.com",
    category: "participatory",
    summary: "Answer complete customer questions in a durable question-and-answer format.",
    expectation: "Use a real expert identity, disclose affiliation, and make the answer useful without requiring a click.",
    tasks: [
      { key: "find-question", title: "Find a customer question", description: "Choose a question closely tied to the audience problem, service, or purchase decision.", actionHref: "/distribution#community", actionLabel: "Find questions" },
      { key: "publish-complete-answer", title: "Publish a complete answer", description: "Give a practical, specific answer with examples and transparent affiliation; add a link only when it supplies needed evidence.", actionHref: "/distribution#community", actionLabel: "Draft answer" },
      { key: "record-answer", title: "Record and monitor the answer", description: "Save the public answer URL and monitor referral visits and later AI evidence separately.", actionHref: "/analytics", actionLabel: "Open analytics", requiresProof: true, proofLabel: "Quora answer URL", proofPlaceholder: "https://www.quora.com/.../answer/...", proofHostnames: ["quora.com"] },
    ],
  },
  {
    key: "reviews",
    name: "Review platforms",
    domain: "G2 · Trustpilot · Yelp · industry sites",
    category: "earned",
    summary: "Build accurate third-party profiles and invite honest, representative customer feedback.",
    expectation: "Use only platforms relevant to the business. Never buy, gate, or script positive reviews.",
    tasks: [
      { key: "choose-platform", title: "Choose the relevant review source", description: "Select the review or directory platform customers in this industry actually use and complete the business profile accurately.", actionHref: "/reviews", actionLabel: "Open reviews", requiresProof: true, proofLabel: "Public review profile URL", proofPlaceholder: "https://review-platform.com/your-business" },
      { key: "request-honest-reviews", title: "Request honest reviews", description: "Invite real customers without incentives or review gating and make it easy for them to share their own experience.", actionHref: "/reviews", actionLabel: "Prepare requests" },
      { key: "respond-and-link", title: "Respond and connect the proof", description: "Respond constructively, keep profile information current, and link the relevant public profile from the website when appropriate.", actionHref: "/reviews", actionLabel: "Manage reviews" },
    ],
  },
  {
    key: "earned-media",
    name: "Earned media",
    domain: "Industry publishers · news · research",
    category: "earned",
    summary: "Earn independent coverage that corroborates the business beyond its own claims.",
    expectation: "Coverage must be independently editorial and genuinely relevant; a press release alone is not third-party validation.",
    tasks: [
      { key: "prepare-proof", title: "Prepare a source-worthy proof package", description: "Collect original data, expert credentials, customer evidence, clear quotes, and the primary documents that support the story.", actionHref: "/content", actionLabel: "Prepare proof" },
      { key: "match-publishers", title: "Match the story to credible publishers", description: "Identify journalists, newsletters, podcasts, associations, or industry publications whose audiences genuinely need the evidence.", actionHref: "/distribution", actionLabel: "Plan outreach" },
      { key: "earn-mention", title: "Earn and record an independent mention", description: "Pitch a useful contribution, then save the exact live coverage URL when independent editorial mention is secured.", actionHref: "/distribution", actionLabel: "Open outreach", requiresProof: true, proofLabel: "Independent coverage URL", proofPlaceholder: "https://publisher.com/coverage" },
    ],
  },
  {
    key: "wikipedia",
    name: "Wikipedia",
    domain: "wikipedia.org",
    category: "earned",
    summary: "Treat Wikipedia as an earned-reference outcome, never as a promotional distribution channel.",
    expectation: "Most businesses are not eligible. Completing this checklist never means a page will be accepted or retained.",
    tasks: [
      { key: "check-notability", title: "Check independent coverage and notability", description: "Confirm substantial coverage in multiple independent, reliable secondary sources—not press releases, paid profiles, or the company website.", actionHref: "https://en.wikipedia.org/wiki/Wikipedia:Notability_(organizations_and_companies)", actionLabel: "Read notability policy" },
      { key: "build-source-dossier", title: "Build an independent source dossier", description: "Collect the strongest independent coverage and note exactly which neutral facts each source supports before proposing any article or edit.", actionHref: "https://en.wikipedia.org/wiki/Wikipedia:Reliable_sources", actionLabel: "Review source policy" },
      { key: "use-coi-route", title: "Use the conflict-of-interest route", description: "Disclose any conflict of interest. If the subject is eligible, use Articles for Creation or a requested edit on the Talk page instead of promotional self-editing.", actionHref: "https://en.wikipedia.org/wiki/Wikipedia:Conflict_of_interest", actionLabel: "Read COI policy" },
    ],
  },
  {
    key: "medium",
    name: "Medium",
    domain: "medium.com",
    category: "participatory",
    summary: "Adapt selected expert perspectives for a discovery platform without duplicating the entire content strategy.",
    expectation: "Use Medium selectively and preserve the original source relationship when republishing.",
    tasks: [
      { key: "select-article", title: "Select a proven expert article", description: "Choose an owned article with a clear point of view, original expertise, and evidence that fits Medium readers.", actionHref: "/content", actionLabel: "Choose article" },
      { key: "adapt-article", title: "Adapt it for the platform", description: "Rewrite the introduction and context for Medium, preserve source links, and set a canonical link when republishing the same work.", actionHref: "/content", actionLabel: "Prepare adaptation" },
      { key: "publish-and-connect", title: "Publish with entity context", description: "Use a complete author profile, connect the business naturally, and link readers to the original resource when useful.", actionHref: "/distribution", actionLabel: "Open distribution", requiresProof: true, proofLabel: "Medium article URL", proofPlaceholder: "https://medium.com/@author/...", proofHostnames: ["medium.com"] },
    ],
  },
] as const;

export type LlmVisibilityTaskRecord = {
  id?: string;
  source_key: string;
  task_key: string;
  status: string;
  completed_at?: string | null;
  proof_url?: string | null;
  proof_attached_at?: string | null;
  updated_at?: string;
};

type LlmVisibilitySignal = {
  status?: unknown;
  totalMentions?: unknown;
  platforms?: Array<{ platform?: unknown; mentions?: unknown }>;
};

const sourceByKey = new Map(LLM_SOURCE_PLAYBOOKS.map((source) => [source.key, source]));

const CITATION_DOMAIN_PLAYBOOKS: Readonly<Record<string, LlmSourceKey>> = {
  "reddit.com": "reddit",
  "wikipedia.org": "wikipedia",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "linkedin.com": "linkedin",
  "quora.com": "quora",
  "medium.com": "medium",
  "forbes.com": "earned-media",
};

export function citationDomainPlaybookKey(domain: string): LlmSourceKey | null {
  const normalized = domain.trim().toLowerCase().replace(/^www\./, "").replace(/^en\./, "");
  return CITATION_DOMAIN_PLAYBOOKS[normalized] ?? null;
}

function taskIdentity(sourceKey: string, taskKey: string) {
  return `${sourceKey}:${taskKey}`;
}

export function buildLlmSourceProgress({
  records,
  llmVisibility,
}: {
  records: LlmVisibilityTaskRecord[];
  llmVisibility: LlmVisibilitySignal;
}) {
  const completedIdentities = new Set(records.flatMap((record) => {
    const source = sourceByKey.get(record.source_key as LlmSourceKey);
    const validTask = source?.tasks.some((task) => task.key === record.task_key);
    return validTask && record.status === "complete" ? [taskIdentity(record.source_key, record.task_key)] : [];
  }));
  const sources = LLM_SOURCE_PLAYBOOKS.map((source) => {
    const tasks = source.tasks.map((task) => ({
      ...task,
      status: completedIdentities.has(taskIdentity(source.key, task.key)) ? "complete" as const : "todo" as const,
      completedAt: records.find((record) => record.source_key === source.key && record.task_key === task.key && record.status === "complete")?.completed_at ?? null,
      proofUrl: records.find((record) => record.source_key === source.key && record.task_key === task.key && record.status === "complete")?.proof_url ?? null,
      proofAttachedAt: records.find((record) => record.source_key === source.key && record.task_key === task.key && record.status === "complete")?.proof_attached_at ?? null,
    }));
    const completed = tasks.filter((task) => task.status === "complete").length;
    const proofPossible = tasks.filter((task) => task.requiresProof).length;
    const proofAttached = tasks.filter((task) => task.requiresProof && task.status === "complete" && task.proofUrl).length;
    return {
      ...source,
      tasks,
      completed,
      total: tasks.length,
      percent: Math.round((completed / tasks.length) * 100),
      proofAttached,
      proofPossible,
      state: completed === tasks.length ? "complete" as const : completed > 0 ? "in_progress" as const : "not_started" as const,
    };
  });
  const completed = sources.reduce((total, source) => total + source.completed, 0);
  const total = sources.reduce((sum, source) => sum + source.total, 0);
  const proofAttached = sources.reduce((sum, source) => sum + source.proofAttached, 0);
  const proofPossible = sources.reduce((sum, source) => sum + source.proofPossible, 0);
  const totalMentions = Math.max(0, Number(llmVisibility.totalMentions ?? 0));
  const evidenceAvailable = llmVisibility.status === "available";
  const detected = evidenceAvailable && totalMentions > 0;
  const platforms = Array.isArray(llmVisibility.platforms) ? llmVisibility.platforms : [];

  return {
    readiness: {
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 0,
      label: `${completed} of ${total} source-readiness actions complete`,
    },
    publicProof: {
      attached: proofAttached,
      possible: proofPossible,
      percent: proofPossible ? Math.round((proofAttached / proofPossible) * 100) : 0,
      label: `${proofAttached} of ${proofPossible} proof-bearing actions have public proof attached`,
    },
    verifiedVisibility: {
      detected,
      evidenceAvailable,
      totalMentions,
      platformCount: platforms.filter((platform) => Number(platform.mentions ?? 0) > 0).length,
      label: detected
        ? `${totalMentions.toLocaleString()} provider-detected mentions`
        : evidenceAvailable
          ? "No provider-detected mentions yet"
          : "Provider monitoring is not available yet",
    },
    sources,
    nextTask: sources.flatMap((source) => source.tasks.map((task) => ({ sourceKey: source.key, sourceName: source.name, ...task }))).find((task) => task.status !== "complete") ?? null,
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function proofUrlMatchesWebsite(proofUrl: string, normalizedDomain: string) {
  try {
    const hostname = new URL(proofUrl).hostname.toLowerCase().replace(/^www\./, "");
    const domain = normalizedDomain.trim().toLowerCase().replace(/^www\./, "");
    return Boolean(domain) && (hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function parseLlmTaskUpdate(input: unknown):
  | { ok: true; value: { websiteId: string; sourceKey: LlmSourceKey; taskKey: string; status: LlmTaskStatus; proofUrl: string | null } }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Choose a valid source task." };
  const body = input as Record<string, unknown>;
  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  const sourceKey = typeof body.sourceKey === "string" ? body.sourceKey.trim() : "";
  const taskKey = typeof body.taskKey === "string" ? body.taskKey.trim() : "";
  const status = body.status === "todo" || body.status === "complete" ? body.status : null;
  const source = sourceByKey.get(sourceKey as LlmSourceKey);
  const task = source?.tasks.find((candidate) => candidate.key === taskKey);
  if (!UUID_PATTERN.test(websiteId) || !source || !task || !status) {
    return { ok: false, error: "Choose a valid source task and status." };
  }
  if (status === "todo") return { ok: true, value: { websiteId, sourceKey: source.key, taskKey, status, proofUrl: null } };
  if (!task.requiresProof) return { ok: true, value: { websiteId, sourceKey: source.key, taskKey, status, proofUrl: null } };

  const proofInput = typeof body.proofUrl === "string" ? body.proofUrl.trim() : "";
  let proofUrl: URL;
  try {
    proofUrl = new URL(proofInput);
  } catch {
    return { ok: false, error: "Add a valid public proof URL before marking this task done." };
  }
  if (proofUrl.protocol !== "https:" || proofUrl.username || proofUrl.password) {
    return { ok: false, error: "Public proof must use a secure HTTPS URL." };
  }
  if (task.proofHostnames?.length && !task.proofHostnames.some((hostname) => proofUrl.hostname === hostname || proofUrl.hostname.endsWith(`.${hostname}`))) {
    return { ok: false, error: `Use a ${source.name} public URL for this task.` };
  }
  return { ok: true, value: { websiteId, sourceKey: source.key, taskKey, status, proofUrl: proofUrl.toString() } };
}
