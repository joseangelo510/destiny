export type BusinessSearchField =
  | "productsServices"
  | "problemSolved"
  | "idealCustomer"
  | "audienceChallengesGoals"
  | "differentiation"
  | "market";

export type BusinessSearchContext = {
  businessName?: string;
  productsServices?: string;
  problemSolved?: string;
  idealCustomer?: string;
  audienceChallengesGoals?: string;
  differentiation?: string;
  market?: string;
};

export type KeywordTheme = {
  id: string;
  label: string;
  funnelRole: "conversion" | "consideration" | "awareness" | "technical_authority";
  priority: "primary" | "secondary" | "supporting";
  seedKeywords: string[];
  requiredTerms: string[];
  negativeTerms: string[];
  evidence: Array<{ field: BusinessSearchField; quote: string }>;
};

export type BusinessSearchBrief = {
  source: "claude-opus-4-8" | "deterministic";
  model: string | null;
  businessSummary: string;
  offerVsEnablement: {
    whatCompanySells: string[];
    whatProductEnables: string[];
    notTheOffer: string[];
  };
  audiences: string[];
  problems: string[];
  differentiators: string[];
  themes: KeywordTheme[];
  warning?: string;
};

export type BusinessSearchBriefConfig = {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
};

type KnownCompetitor = { name: string; url?: string | null };

const FIELD_LABELS: Array<{ field: BusinessSearchField; label: string; funnelRole: KeywordTheme["funnelRole"]; priority: KeywordTheme["priority"] }> = [
  { field: "productsServices", label: "Products and services", funnelRole: "conversion", priority: "primary" },
  { field: "problemSolved", label: "Problems and demand", funnelRole: "awareness", priority: "primary" },
  { field: "idealCustomer", label: "Audience use cases", funnelRole: "consideration", priority: "secondary" },
  { field: "audienceChallengesGoals", label: "Customer outcomes", funnelRole: "awareness", priority: "secondary" },
  { field: "differentiation", label: "Differentiated capabilities", funnelRole: "technical_authority", priority: "primary" },
  { field: "market", label: "Market relevance", funnelRole: "conversion", priority: "supporting" },
];

const PHRASE_PATTERNS = [
  /\b(?:general purpose\s+)?programming language\b/gi,
  /\benglish[-\s]+syntax\b/gi,
  /\b(?:data\s*center|datacenter)s?\b/gi,
  /\bhigh[-\s]+performance compute(?: processing)?\b/gi,
  /\bpower consumption\b/gi,
  /\bsat solver\b/gi,
  /\bsuper compiler\b/gi,
  /\bsystem\s*verilog assertions?\b/gi,
  /\bcomputer chip architecture(?: design)?\b/gi,
  /\bprovably bug[-\s]+free\b/gi,
  /\bsoftware developers?\b/gi,
  /\bvibe coders?\b/gi,
  /\bsoftware and firmware\b/gi,
];

const GENERIC_SEEDS = new Set([
  "build software",
  "help customers",
  "products services",
  "provide services",
  "solve problems",
]);

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    businessSummary: { type: "string" },
    offerVsEnablement: {
      type: "object",
      additionalProperties: false,
      properties: {
        whatCompanySells: { type: "array", items: { type: "string" } },
        whatProductEnables: { type: "array", items: { type: "string" } },
        notTheOffer: { type: "array", items: { type: "string" } },
      },
      required: ["whatCompanySells", "whatProductEnables", "notTheOffer"],
    },
    audiences: { type: "array", items: { type: "string" } },
    problems: { type: "array", items: { type: "string" } },
    differentiators: { type: "array", items: { type: "string" } },
    themes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          funnelRole: { type: "string", enum: ["conversion", "consideration", "awareness", "technical_authority"] },
          priority: { type: "string", enum: ["primary", "secondary", "supporting"] },
          seedKeywords: { type: "array", maxItems: 8, items: { type: "string" } },
          requiredTerms: { type: "array", items: { type: "string" } },
          negativeTerms: { type: "array", items: { type: "string" } },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                field: { type: "string", enum: ["productsServices", "problemSolved", "idealCustomer", "audienceChallengesGoals", "differentiation", "market"] },
                quote: { type: "string" },
              },
              required: ["field", "quote"],
            },
          },
        },
        required: ["id", "label", "funnelRole", "priority", "seedKeywords", "requiredTerms", "negativeTerms", "evidence"],
      },
    },
  },
  required: ["businessSummary", "offerVsEnablement", "audiences", "problems", "differentiators", "themes"],
} as const;

function clean(value: unknown, maximum = 220) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximum) : "";
}

function uniqueStrings(value: unknown, limit: number, maximum = 160) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    const text = clean(item, maximum);
    const key = text.toLocaleLowerCase();
    if (!text || seen.has(key) || seen.size >= limit) return [];
    seen.add(key);
    return [text];
  });
}

function slug(value: string, fallback: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || fallback;
}

function normalizeEvidence(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fieldValue(context: BusinessSearchContext, field: BusinessSearchField) {
  return clean(context[field], 4_000);
}

function exactEvidence(context: BusinessSearchContext, field: BusinessSearchField, quote: string) {
  const source = normalizeEvidence(fieldValue(context, field));
  const evidence = normalizeEvidence(quote);
  return evidence.length >= 3 && source.includes(evidence);
}

function phraseGroundedInOnboarding(context: BusinessSearchContext, phrase: string) {
  const onboardingTokens = new Set(normalizeEvidence(FIELD_LABELS.map(({ field }) => fieldValue(context, field)).join(" ")).split(/\s+/).filter(Boolean));
  const phraseTokens = normalizeEvidence(phrase).split(/\s+/).filter(Boolean);
  return phraseTokens.length > 0 && phraseTokens.every((token) => onboardingTokens.has(token));
}

function seedContainsAnchor(seed: string, anchors: string[]) {
  const seedTokens = new Set(normalizeEvidence(seed).split(/\s+/).filter(Boolean));
  return anchors.some((anchor) => {
    const anchorTokens = normalizeEvidence(anchor).split(/\s+/).filter(Boolean);
    return anchorTokens.length > 0 && anchorTokens.every((token) => seedTokens.has(token));
  });
}

function phraseCandidates(value: string) {
  const phrases: string[] = [];
  const add = (candidate: string) => {
    const text = clean(candidate, 100).replace(/^(?:we|our|they|their|the)\s+/i, "");
    const key = normalizeEvidence(text);
    if (!text || key.split(/\s+/).length < 2 || GENERIC_SEEDS.has(key) || phrases.some((item) => normalizeEvidence(item) === key)) return;
    phrases.push(text);
  };
  for (const pattern of PHRASE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of value.matchAll(pattern)) add(match[0]);
  }
  const segments = value.split(/(?:[.,;\n]|\band\b|\bbut\b|\bso that\b)/i);
  for (const segment of segments) {
    const words = normalizeEvidence(segment).split(/\s+/).filter((word) => word.length >= 3 && !/^(?:about|also|anyone|based|been|called|core|from|have|helps?|into|just|make|more|that|their|them|they|this|through|using|want|with|world)$/.test(word));
    if (words.length >= 2 && words.length <= 10) add(words.join(" "));
    else if (words.length > 10) {
      add(words.slice(0, 6).join(" "));
      add(words.slice(-6).join(" "));
    }
  }
  return phrases.slice(0, 8);
}

function productServiceCandidates(value: string) {
  const source = clean(value, 4_000)
    .replace(/^[\s]*(?:we|our (?:company|business))\s+(?:provide|offer|sell|build|create|deliver)\s+/i, "")
    .replace(/\bincluding\b/gi, ",")
    .replace(/[–—-]+/g, " ");
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (candidate: string) => {
    const text = candidate.replace(/\s+/g, " ").trim();
    const key = normalizeEvidence(text);
    const words = key.split(/\s+/).filter(Boolean);
    if (!key || words.length < 2 || words.length > 9 || seen.has(key)) return;
    if (/^(?:san francisco )?bay area$|^united states$/i.test(text)) return;
    seen.add(key);
    candidates.push(text);
  };
  for (const raw of source.split(/[,;.!?\n]+/)) {
    const withoutLeadingJoiner = raw
      .replace(/^\s*(?:and|or)\s+/i, "")
      .replace(/^\s*(?:our\s+)?(?:core\s+)?product\s+is\s+/i, "")
      .replace(/^\s*it\s+is\s+/i, "")
      .trim();
    const withoutLocation = withoutLeadingJoiner
      .replace(/\s+(?:in|serving|across)\s+(?=(?:the\s+)?[A-Z])[\s\S]*$/, "")
      .replace(/[.!?]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
    add(withoutLocation);
    const coordinated = withoutLocation.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
    if (coordinated.length === 2) {
      add(coordinated[0]);
      add(coordinated[1]);
      const leftWords = coordinated[0].split(/\s+/).filter(Boolean);
      const rightWords = coordinated[1].split(/\s+/).filter(Boolean);
      if (leftWords.length === 1 && rightWords.length === 2) add(`${leftWords[0]} ${rightWords[1]}`);
    }
  }
  return candidates.slice(0, 8);
}

function evidenceExcerpt(value: string) {
  const trimmed = clean(value, 4_000);
  const first = trimmed.split(/[.;\n]/)[0]?.trim() || trimmed;
  return first.slice(0, 180);
}

export function deterministicBusinessSearchBrief(context: BusinessSearchContext, warning?: string): BusinessSearchBrief {
  const themes = FIELD_LABELS.flatMap(({ field, label, funnelRole, priority }) => {
    const value = fieldValue(context, field);
    if (!value) return [];
    const phrases = (field === "productsServices" ? productServiceCandidates(value) : phraseCandidates(value))
      .filter((phrase) => normalizeEvidence(phrase) !== "build software");
    if (!phrases.length) return [];
    const seeds = phrases.slice(0, 4);
    return [{
      id: slug(label, field),
      label,
      funnelRole,
      priority,
      seedKeywords: seeds,
      requiredTerms: seeds.slice(0, 3),
      negativeTerms: [],
      evidence: [{ field, quote: evidenceExcerpt(value) }],
    } satisfies KeywordTheme];
  }).slice(0, 8);

  const products = productServiceCandidates(fieldValue(context, "productsServices")).slice(0, 8);
  const audiences = phraseCandidates(fieldValue(context, "idealCustomer")).slice(0, 6);
  const problems = phraseCandidates(`${fieldValue(context, "problemSolved")} ${fieldValue(context, "audienceChallengesGoals")}`).slice(0, 8);
  const differentiators = phraseCandidates(fieldValue(context, "differentiation")).slice(0, 8);
  const summaryParts = [context.businessName, products[0], audiences[0]].map((value) => clean(value, 120)).filter(Boolean);
  return {
    source: "deterministic",
    model: null,
    businessSummary: summaryParts.join(" · ") || "Destiny built a conservative search brief from the complete onboarding record.",
    offerVsEnablement: {
      whatCompanySells: products,
      whatProductEnables: problems,
      notTheOffer: [],
    },
    audiences,
    problems,
    differentiators,
    themes,
    ...(warning ? { warning } : {}),
  };
}

function parseTheme(value: unknown, context: BusinessSearchContext, index: number): KeywordTheme | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const funnelRole = clean(row.funnelRole) as KeywordTheme["funnelRole"];
  const priority = clean(row.priority) as KeywordTheme["priority"];
  if (!["conversion", "consideration", "awareness", "technical_authority"].includes(funnelRole)) return null;
  if (!["primary", "secondary", "supporting"].includes(priority)) return null;
  const requiredTerms = uniqueStrings(row.requiredTerms, 6, 80)
    .filter((term) => phraseGroundedInOnboarding(context, term));
  if (!requiredTerms.length) return null;
  const seedKeywords = uniqueStrings(row.seedKeywords, 8, 100).filter((seed) => {
    const words = normalizeEvidence(seed).split(/\s+/);
    return words.length >= 2 && words.length <= 10 && !GENERIC_SEEDS.has(normalizeEvidence(seed))
      && seedContainsAnchor(seed, requiredTerms);
  });
  if (!seedKeywords.length || !requiredTerms.length) return null;
  const evidence = Array.isArray(row.evidence) ? row.evidence.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const entry = item as Record<string, unknown>;
    const field = clean(entry.field) as BusinessSearchField;
    const quote = clean(entry.quote, 220);
    return FIELD_LABELS.some((candidate) => candidate.field === field) && exactEvidence(context, field, quote)
      ? [{ field, quote }]
      : [];
  }).slice(0, 4) : [];
  if (!evidence.length) return null;
  const label = clean(row.label, 100) || `Search theme ${index + 1}`;
  return {
    id: slug(clean(row.id, 80), `theme-${index + 1}`),
    label,
    funnelRole,
    priority,
    seedKeywords,
    requiredTerms,
    negativeTerms: uniqueStrings(row.negativeTerms, 8, 80),
    evidence,
  };
}

function parseClaudeBrief(value: unknown, context: BusinessSearchContext, model: string): BusinessSearchBrief {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Claude returned an invalid business brief.");
  const row = value as Record<string, unknown>;
  const offer = row.offerVsEnablement && typeof row.offerVsEnablement === "object" && !Array.isArray(row.offerVsEnablement)
    ? row.offerVsEnablement as Record<string, unknown>
    : {};
  let themes = Array.isArray(row.themes)
    ? row.themes.map((theme, index) => parseTheme(theme, context, index)).filter((theme): theme is KeywordTheme => Boolean(theme)).slice(0, 8)
    : [];
  if (themes.length < 3) throw new Error("Claude did not return enough evidence-backed search themes.");
  const requiredCoverage = FIELD_LABELS.map(({ field }) => field)
    .filter((field) => field !== "market" && Boolean(fieldValue(context, field)));
  const coveredFields = new Set(themes.flatMap((theme) => theme.evidence.map((evidence) => evidence.field)));
  const missingCoverage = requiredCoverage.filter((field) => !coveredFields.has(field));
  let coverageWarning: string | undefined;
  if (missingCoverage.length) {
    const fallback = deterministicBusinessSearchBrief(context);
    const supplementalThemes = missingCoverage.flatMap((field) => {
      const theme = fallback.themes.find((candidate) => candidate.evidence.some((evidence) => evidence.field === field));
      return theme ? [theme] : [];
    });
    themes = [...themes.slice(0, Math.max(3, 8 - supplementalThemes.length)), ...supplementalThemes].slice(0, 8);
    const supplementedFields = new Set(themes.flatMap((theme) => theme.evidence.map((evidence) => evidence.field)));
    const stillMissing = requiredCoverage.filter((field) => !supplementedFields.has(field));
    if (stillMissing.length) throw new Error(`Claude omitted onboarding evidence: ${stillMissing.join(", ")}.`);
    coverageWarning = `Claude Opus 4.8 omitted evidence for ${missingCoverage.join(", ")}; Destiny supplemented those fields from its conservative onboarding parser.`;
  }
  const enablement = uniqueStrings(offer.whatProductEnables, 8);
  const leakedOutcome = themes.flatMap((theme) => theme.seedKeywords).find((seed) => enablement.some((outcome) => {
    const normalizedOutcome = normalizeEvidence(outcome);
    return normalizedOutcome.length >= 4 && normalizeEvidence(seed).includes(normalizedOutcome);
  }));
  if (leakedOutcome) throw new Error(`Claude used a customer outcome as a keyword seed: ${leakedOutcome}.`);
  return {
    source: "claude-opus-4-8",
    model,
    businessSummary: clean(row.businessSummary, 500),
    offerVsEnablement: {
      whatCompanySells: uniqueStrings(offer.whatCompanySells, 8),
      whatProductEnables: enablement,
      notTheOffer: uniqueStrings(offer.notTheOffer, 10),
    },
    audiences: uniqueStrings(row.audiences, 10),
    problems: uniqueStrings(row.problems, 10),
    differentiators: uniqueStrings(row.differentiators, 10),
    themes,
    ...(coverageWarning ? { warning: coverageWarning } : {}),
  };
}

function systemPrompt() {
  return `You are Destiny's semantic SEO strategist. Your job is to listen to the complete onboarding record before proposing search themes.

Non-negotiable rules:
1. Treat every onboarding field as evidence. Never let the first short phrase dominate longer answers.
2. Explicitly separate what the company SELLS from what its product ENABLES customers to build or accomplish. If a programming language enables customers to build software, do not infer that the company sells every category of software.
3. Return 5-8 genuinely distinct search themes when the evidence supports them. Cover the primary offer, customer problems, audiences/use cases, differentiators, and technical authority. Do not create shallow word-order variations.
4. Conversion and revenue matter, but they do not override semantic truth. Include consideration, awareness, and technical-authority themes when they create a credible path to demand or trust.
5. Give every theme 4-8 distinct discovery seeds. Prefer natural 2-4 word category, problem, comparison, and buyer phrases so DataForSEO can expand a niche market; avoid merely reordering the same phrase. Seeds are inputs, not measured facts. Never invent search volume, CPC, difficulty, ranking, or intent. DataForSEO owns those measurements.
6. Every theme must cite at least one exact excerpt and its onboarding field. Do not introduce an offer, audience, capability, or competitor that is absent from the supplied record.
7. Put misleading interpretations and unrelated categories in notTheOffer and/or negativeTerms.
8. Prefer short, natural search phrases with a distinctive business anchor. Avoid generic seeds such as "build software", "services", or "solutions".`;
}

function userPrompt(context: BusinessSearchContext, knownCompetitors: KnownCompetitor[]) {
  return JSON.stringify({
    task: "Create an evidence-backed business and search-theme brief for keyword discovery.",
    onboarding: context,
    knownCompetitors: knownCompetitors.map((competitor) => ({ name: clean(competitor.name, 160), url: clean(competitor.url, 2_048) })),
    reminder: "Competitors are context only. Do not copy an unrelated competitor category into the company's offer.",
  });
}

export async function createBusinessSearchBrief(
  context: BusinessSearchContext,
  knownCompetitors: KnownCompetitor[] = [],
  config: BusinessSearchBriefConfig = {},
  fetcher: typeof fetch = fetch,
): Promise<BusinessSearchBrief> {
  const apiKey = config.apiKey?.trim();
  const model = config.model?.trim() || "claude-opus-4-8";
  if (!apiKey) return deterministicBusinessSearchBrief(context, "Claude Opus 4.8 keyword synthesis is not configured; Destiny used its conservative full-context fallback.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(5_000, config.timeoutMs ?? 45_000));
  try {
    const response = await fetcher("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        max_tokens: 5_000,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "high",
          format: { type: "json_schema", schema: BRIEF_SCHEMA },
        },
        system: systemPrompt(),
        messages: [{ role: "user", content: userPrompt(context, knownCompetitors) }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Claude returned HTTP ${response.status}.`);
    const payload = await response.json() as { stop_reason?: unknown; content?: unknown };
    if (payload.stop_reason === "max_tokens" || payload.stop_reason === "refusal") {
      throw new Error(`Claude stopped with ${String(payload.stop_reason)}.`);
    }
    const content = Array.isArray(payload.content) ? payload.content : [];
    const text = content.flatMap((block) => block && typeof block === "object" && !Array.isArray(block)
      && (block as Record<string, unknown>).type === "text" && typeof (block as Record<string, unknown>).text === "string"
      ? [(block as Record<string, string>).text]
      : []).join("");
    if (!text) throw new Error("Claude did not return a structured business brief.");
    return parseClaudeBrief(JSON.parse(text), context, model);
  } catch (cause) {
    const reason = cause instanceof Error && cause.name === "AbortError"
      ? "timed out"
      : cause instanceof Error ? cause.message : "was unavailable";
    return deterministicBusinessSearchBrief(context, `Claude Opus 4.8 keyword synthesis failed (${reason}); Destiny used its conservative full-context fallback.`);
  } finally {
    clearTimeout(timeout);
  }
}

export function themeSeeds(brief: BusinessSearchBrief, limit = 16) {
  const priorityOrder: Record<KeywordTheme["priority"], number> = { primary: 0, secondary: 1, supporting: 2 };
  const themes = [...brief.themes].sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority]);
  const queues = themes.map((theme) => [...theme.seedKeywords]);
  const seeds: string[] = [];
  const seen = new Set<string>();
  while (seeds.length < limit && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const seed = queue.shift();
      const key = normalizeEvidence(seed ?? "");
      if (!seed || !key || seen.has(key)) continue;
      seen.add(key);
      seeds.push(seed);
      if (seeds.length === limit) break;
    }
  }
  return seeds;
}

export function keywordDiscoveryThemes(brief: BusinessSearchBrief) {
  return brief.themes.filter((theme) => {
    const fields = new Set(theme.evidence.map((item) => item.field));
    if (fields.has("productsServices") || fields.has("problemSolved")) return true;
    return fields.has("differentiation")
      && theme.priority === "primary"
      && (theme.funnelRole === "consideration" || theme.funnelRole === "technical_authority");
  });
}

export function buyerExpansionSeeds(brief: BusinessSearchBrief, limit = 8) {
  const suitable = (value: string, maximumWords: number) => {
    const words = normalizeEvidence(value).split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= maximumWords;
  };
  const unique = (values: string[], maximumWords: number) => {
    const seen = new Set<string>();
    return values.flatMap((value) => {
      const cleaned = clean(value, 120);
      const key = normalizeEvidence(cleaned);
      if (!cleaned || !suitable(cleaned, maximumWords) || seen.has(key)) return [];
      seen.add(key);
      return [cleaned];
    });
  };
  const offerThemes = keywordDiscoveryThemes(brief).filter((theme) => theme.funnelRole !== "awareness");
  const audienceThemes = brief.themes.filter((theme) =>
    theme.evidence.some((item) => item.field === "idealCustomer"));
  const offerQueues = offerThemes.map((theme) => [...theme.seedKeywords]);
  const balancedOfferSeeds: string[] = [];
  while (offerQueues.some((queue) => queue.length)) {
    for (const queue of offerQueues) {
      const seed = queue.shift();
      if (seed) balancedOfferSeeds.push(seed);
    }
  }
  const offers = unique([
    ...balancedOfferSeeds,
    ...brief.offerVsEnablement.whatCompanySells,
  ], 8);
  const audiences = unique([
    ...audienceThemes.flatMap((theme) => theme.seedKeywords),
    ...brief.audiences,
  ], 5);
  const seeds: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const key = normalizeEvidence(value);
    if (!key || seen.has(key) || seeds.length >= limit) return;
    seen.add(key);
    seeds.push(value);
  };
  offers.slice(0, Math.max(1, Math.ceil(limit / 2))).forEach(add);
  for (const offer of offers.slice(0, 3)) {
    for (const audience of audiences.slice(0, 4)) {
      add(`${offer} for ${audience}`);
      if (seeds.length >= limit) return seeds;
    }
  }
  return seeds;
}
