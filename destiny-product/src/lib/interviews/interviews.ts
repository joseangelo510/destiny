import { DEFAULT_ARTICLE_PREFERENCES } from "@/lib/content/article-generation";
import {
  type ArticleDraft,
  fitMetaDescription,
  normalizeArticleBody,
} from "@/lib/content/article-draft";

export type InterviewTopicInput = {
  businessName: string;
  productsServices: string;
  idealCustomer: string;
  problemSolved: string;
  differentiation: string;
  approvedKeywords: Array<{ keyword: string; searchVolume: number | null }>;
  previousTopics: string[];
};

export type InterviewTopic = {
  title: string;
  angle: string;
  whyNow: string;
  focusKeyword: string;
  searchVolume: number;
  estimatedMinutes: number;
  questionCount: number;
};

export type InterviewQuestionKind =
  | "warm_up"
  | "contrarian"
  | "story"
  | "change"
  | "evidence"
  | "product_tie_in"
  | "audience_advice";

export type InterviewQuestion = {
  position: number;
  kind: InterviewQuestionKind;
  text: string;
};

function clean(value: string, fallback: string) {
  return value.trim().replace(/\s+/g, " ") || fallback;
}

function sentenceCase(value: string) {
  const normalized = clean(value, "your expertise");
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function topicTitle(keyword: string, index: number) {
  const subject = sentenceCase(keyword);
  if (index === 0) return `${subject}: what I actually tell customers`;
  if (index === 1) return `The ${keyword} mistakes I warn customers about`;
  return `What has changed about ${keyword} — and what still matters`;
}

export function buildInterviewTopicSuggestions(input: InterviewTopicInput): InterviewTopic[] {
  const previous = new Set(input.previousTopics.map((topic) => topic.trim().toLocaleLowerCase()));
  const sorted = [...input.approvedKeywords]
    .filter((item) => item.keyword.trim())
    .sort((left, right) => Number(right.searchVolume ?? 0) - Number(left.searchVolume ?? 0));
  const fallbackKeywords = [input.productsServices, input.problemSolved, input.differentiation]
    .map((value) => clean(value, ""))
    .filter(Boolean)
    .map((keyword) => ({ keyword: keyword.slice(0, 120), searchVolume: null }));
  const candidates = [...sorted, ...fallbackKeywords];
  const seen = new Set<string>();
  const topics: InterviewTopic[] = [];

  for (const candidate of candidates) {
    const keyword = clean(candidate.keyword, "your customers' biggest questions");
    const normalized = keyword.toLocaleLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const title = topicTitle(keyword, topics.length);
    if (previous.has(title.toLocaleLowerCase())) continue;
    const approved = sorted.some((item) => item.keyword.trim().toLocaleLowerCase() === normalized);
    topics.push({
      title,
      angle: `Share the firsthand lessons, customer stories, and practical judgment only ${clean(input.businessName, "your business")} can provide.`,
      whyNow: approved
        ? `This comes from your approved keyword “${keyword}” and gives Destiny real expertise to use in future content.`
        : `This fills a gap in your Voice Library using what Destiny already understands about your business.`,
      focusKeyword: keyword,
      searchVolume: Math.max(0, Number(candidate.searchVolume ?? 0)),
      estimatedMinutes: 10 + (topics.length % 2) * 2,
      questionCount: 7,
    });
    if (topics.length === 3) break;
  }

  if (!topics.length) {
    topics.push({
      title: "The advice I wish every customer heard sooner",
      angle: `Explain the mistakes, warning signs, and real decisions ${clean(input.idealCustomer, "your customers")} face.`,
      whyNow: "This starts your Voice Library from the business context you already shared during onboarding.",
      focusKeyword: clean(input.productsServices, "customer advice"),
      searchVolume: 0,
      estimatedMinutes: 10,
      questionCount: 7,
    });
  }
  return topics;
}

export function buildInterviewQuestions(input: {
  topicTitle: string;
  focusKeyword: string;
  businessName: string;
  idealCustomer: string;
  productsServices: string;
  differentiation: string;
}): InterviewQuestion[] {
  const subject = clean(input.focusKeyword, input.topicTitle);
  const audience = clean(input.idealCustomer, "your customers");
  const business = clean(input.businessName, "your business");
  return [
    { position: 1, kind: "warm_up", text: `What is the most important thing ${audience} should understand first about ${subject}?` },
    { position: 2, kind: "contrarian", text: `What do people in your industry commonly get wrong about ${subject}, and what do you believe instead?` },
    { position: 3, kind: "story", text: `Tell me about a specific customer or real situation that shows why your point of view matters. What happened?` },
    { position: 4, kind: "change", text: `What have you changed your mind about recently when it comes to ${subject}? What changed your thinking?` },
    { position: 5, kind: "evidence", text: "Do you have a number, pattern, result, or repeated experience that supports what you just explained?" },
    { position: 6, kind: "product_tie_in", text: `What does ${business} do differently from competitors, and what does that look like for the customer?` },
    { position: 7, kind: "audience_advice", text: `If ${audience} remember only one thing about ${subject}, what should it be?` },
  ];
}

export function validateInterviewAnswer(value: string) {
  const answer = value.trim();
  if (!answer) return { valid: false, nudge: null };
  return {
    valid: true,
    nudge: answer.length < 120 ? "One more detail or real example will make this much stronger." : null,
  };
}

export function buildVoiceContext(input: {
  answers: Array<{ id: string; verbatimText: string; interviewTopic: string }>;
  libraryItems: Array<{ id: string; type: string; body: string; status: string; answerId: string }>;
}) {
  const answers = input.answers
    .filter((answer) => answer.verbatimText.trim())
    .slice(0, 24)
    .map((answer, index) => `[V${index + 1} · ${answer.interviewTopic}] “${answer.verbatimText.trim()}”`);
  const confirmed = input.libraryItems
    .filter((item) => item.status === "confirmed_by_owner" && item.body.trim())
    .slice(0, 20)
    .map((item) => `[${item.type}] ${item.body.trim()} (source answer ${item.answerId})`);
  if (!answers.length && !confirmed.length) return "";
  return [
    "DESTINY VOICE LIBRARY — scoped to this website only",
    "Use quotes verbatim or not at all. Never invent first-person experience, figures, customer stories, or opinions.",
    "Write other prose in the same plain-language rhythm and point of view without pretending it is a direct quote.",
    ...answers,
    ...confirmed,
  ].join("\n").slice(0, 24000);
}

export function buildInterviewArticleDraft(input: {
  interviewId: string;
  topicTitle: string;
  focusKeyword: string;
  businessName: string;
  answers: Array<{ question: string; verbatimText: string }>;
}): ArticleDraft {
  const keyword = clean(input.focusKeyword, input.topicTitle).slice(0, 300);
  const title = clean(input.topicTitle, `${keyword}: an expert interview`);
  const transcript = input.answers.filter((answer) => answer.verbatimText.trim());
  const body = [
    `# ${title}`,
    "",
    `This draft begins with a firsthand interview with ${clean(input.businessName, "the business owner")}. The answers below are preserved word-for-word so Content Studio can build the finished article without inventing expertise.`,
    "",
    "## What the expert said",
    "",
    ...transcript.flatMap((answer) => [
      `### ${clean(answer.question, "Interview question")}`,
      "",
      `> ${answer.verbatimText.trim()}`,
      "",
    ]),
    "## Article direction",
    "",
    `Use these answers as the primary source for a thought-leadership article about ${keyword}. Keep direct quotes exact, distinguish the owner's experience from externally verified facts, and add current research only through Content Studio's normal evidence checks.`,
  ].join("\n");
  const meta = fitMetaDescription(`Firsthand advice about ${keyword}, based on a Destiny interview with ${clean(input.businessName, "an experienced business owner")}.`);
  return {
    keyword,
    title,
    metaTitle: title.slice(0, 60),
    titleCandidates: [],
    metaDescription: meta,
    metaDescriptions: [meta],
    body: normalizeArticleBody(body),
    sources: [],
    infographics: [],
    bucketBrigades: [],
    preferences: { ...DEFAULT_ARTICLE_PREFERENCES, specialInstructions: "Lead with the owner's firsthand point of view. Preserve direct quotes exactly and use the Voice Library automatically." },
    generationStatus: "needs_generation",
    generatedBy: "Destiny Interviews",
    qualityIssues: [{ code: "generation_required", message: "Open this interview draft in Content Studio to add current evidence, SEO structure, and final editorial checks before approval." }],
    optimization: [
      { label: "Interview source", detail: `${transcript.length} exact answers from interview ${input.interviewId}.` },
      { label: "Voice boundary", detail: "Quoted language stays verbatim. Destiny-added framing is never presented as the owner's exact words." },
      { label: "Approval boundary", detail: "This remains a draft until a person reviews and explicitly approves it in Content Studio." },
    ],
  };
}

export function parseInterviewArticleDraft(value: unknown): ArticleDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Partial<ArticleDraft>;
  if (typeof draft.keyword !== "string" || typeof draft.title !== "string" || typeof draft.body !== "string") return null;
  if (draft.generatedBy !== "Destiny Interviews") return null;
  return {
    keyword: draft.keyword,
    title: draft.title,
    metaTitle: typeof draft.metaTitle === "string" ? draft.metaTitle : draft.title.slice(0, 60),
    titleCandidates: Array.isArray(draft.titleCandidates) ? draft.titleCandidates : [],
    metaDescription: typeof draft.metaDescription === "string" ? draft.metaDescription : "",
    metaDescriptions: Array.isArray(draft.metaDescriptions) ? draft.metaDescriptions.filter((item): item is string => typeof item === "string").slice(0, 1) : [],
    body: draft.body,
    sources: Array.isArray(draft.sources) ? draft.sources : [],
    infographics: Array.isArray(draft.infographics) ? draft.infographics : [],
    bucketBrigades: Array.isArray(draft.bucketBrigades) ? draft.bucketBrigades : [],
    preferences: { ...DEFAULT_ARTICLE_PREFERENCES, ...(draft.preferences ?? {}) },
    generationStatus: draft.generationStatus === "generated" ? "generated" : "needs_generation",
    generatedBy: "Destiny Interviews",
    verifiedInternalPages: Array.isArray(draft.verifiedInternalPages) ? draft.verifiedInternalPages : undefined,
    qualityIssues: Array.isArray(draft.qualityIssues) ? draft.qualityIssues : [],
    optimization: Array.isArray(draft.optimization) ? draft.optimization : [],
  };
}
