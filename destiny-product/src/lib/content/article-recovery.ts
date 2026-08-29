import { markdownWordCount, type ArticleFormat } from "./article-generation";

export type ArticleContinuationReason = "max_tokens" | "short" | "unclean" | "short_and_unclean";

// Policy: SEO articles must land in 2,000–3,000 words with 6–9 H2 sections.
// Finishing passes aim inside a buffered band so tokenizer and word-counting
// differences can never leave the combined article straddling the policy
// boundaries. Validation itself still checks the published 2,000/3,000 and
// 6–9 limits — these constants only steer generation, never weaken checks.
export const SEO_ARTICLE_H2_LIMIT = 9;
export const SEO_ARTICLE_RECOVERY_MIN_WORDS = 2_200;
export const SEO_ARTICLE_RECOVERY_MAX_WORDS = 2_900;

// Markdown-aware H2 scan: recognizes ATX H2 headings (0–3 leading spaces per
// CommonMark) while ignoring fenced code blocks and indented code, so a code
// example containing "## comment" is never counted as an article section or
// rewritten by the clamp.
export function scanArticleH2LineIndexes(markdown: string) {
  const lines = markdown.split("\n");
  const indexes: number[] = [];
  let openFence: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (openFence) {
      // CommonMark closing fence: same character, at least the opening
      // length, and nothing but whitespace after the run.
      if (fenceMatch && fenceMatch[1][0] === openFence[0] && fenceMatch[1].length >= openFence.length && fenceMatch[2].trim() === "") openFence = null;
      continue;
    }
    if (fenceMatch) {
      openFence = fenceMatch[1];
      continue;
    }
    if (/^(?: {4,}|\t)/.test(line)) continue; // indented code block
    if (/^ {0,3}##(?:\s|$)/.test(line) && !/^ {0,3}###/.test(line)) indexes.push(index);
  }
  return indexes;
}

export function countH2Sections(markdown: string) {
  return scanArticleH2LineIndexes(markdown).length;
}

export type ArticleContinuationDecision = {
  needed: boolean;
  reason: ArticleContinuationReason | null;
  wordCount: number;
  cleanEnding: boolean;
};

export function articleHasCleanEnding(markdown: string) {
  const value = markdown.trim().replace(/(?:<!--[\s\S]*?-->|\s)+$/g, "").trim();
  if (!value) return false;
  const lastLine = value.split("\n").map((line) => line.trim()).filter(Boolean).at(-1) ?? "";
  if (/^#{1,6}\s+/.test(lastLine) || /[:;,—-]$/.test(lastLine)) return false;
  return /[.!?](?:["')\]*_~`]+)?$/.test(lastLine);
}

export function articleContinuationDecision(
  bodyMarkdown: string,
  format: ArticleFormat,
  stopReason: string | null | undefined,
): ArticleContinuationDecision {
  const wordCount = markdownWordCount(bodyMarkdown);
  const cleanEnding = articleHasCleanEnding(bodyMarkdown);
  if (stopReason === "max_tokens") return { needed: true, reason: "max_tokens", wordCount, cleanEnding };

  const short = format === "seo_article" && wordCount < 2_000;
  if (short && !cleanEnding) return { needed: true, reason: "short_and_unclean", wordCount, cleanEnding };
  if (short) return { needed: true, reason: "short", wordCount, cleanEnding };
  if (!cleanEnding) return { needed: true, reason: "unclean", wordCount, cleanEnding };
  return { needed: false, reason: null, wordCount, cleanEnding };
}

function numberLabel(value: number) {
  return Math.max(0, Math.round(value)).toLocaleString("en-US");
}

export function buildArticleContinuationPrompt({
  bodyMarkdown,
  researchEvidence,
  targetMinimumWords,
  targetMaximumWords,
  reason,
}: {
  bodyMarkdown: string;
  researchEvidence: string;
  targetMinimumWords: number;
  targetMaximumWords: number;
  reason?: ArticleContinuationReason | null;
}) {
  const existing = bodyMarkdown.trim().slice(-20_000);
  const evidence = researchEvidence.trim().slice(0, 12_000);
  const existingWordCount = markdownWordCount(bodyMarkdown);
  // Bound the pass by what the article can still absorb relative to the
  // buffered maximum: a near-ceiling draft that only needs a clean ending
  // must never be told it may expand past the policy ceiling. When almost no
  // capacity remains, the pass is restricted to a single closing sentence.
  const newWordAllowance = Math.max(0, targetMaximumWords - existingWordCount);
  // A cleanly ended but under-length article must be EXPANDED, not
  // "finished": telling the model to only complete missing material invites
  // an "already complete" refusal instead of new copy. The expansion pass
  // states the computed word deficit and demands new in-article H3 coverage.
  const expansionPass = reason === "short" && newWordAllowance >= 60;
  const missingWords = Math.max(0, targetMinimumWords - existingWordCount);
  const wordBudgetRule = newWordAllowance < 60
    ? "The existing article has no remaining word capacity. Finish it with one complete closing sentence only — add no new sections, coverage, or scope."
    : expansionPass
      ? `The article reads complete but is at least ${numberLabel(missingWords)} words below Rebound SEO's minimum. It is NOT complete until it reaches the target. Add ${numberLabel(missingWords)}–${numberLabel(newWordAllowance)} new words of genuinely useful in-article coverage as H3 subsections under the most relevant existing H2 sections: worked examples, objection handling, comparisons, troubleshooting, or FAQ entries the article does not cover yet. Never state or imply that the article is already complete.`
      : `Add at most ${numberLabel(newWordAllowance)} new words. If the existing article already meets the word target, only finish the ending cleanly — do not expand its scope.`;
  const existingH2Count = countH2Sections(bodyMarkdown);
  const remainingH2Count = Math.max(0, SEO_ARTICLE_H2_LIMIT - existingH2Count);
  const h2BudgetRule = remainingH2Count === 0
    ? "Do not add another H2 section. Use H3 subsections or paragraphs to finish missing material."
    : `Add at most ${remainingH2Count} new H2 section${remainingH2Count === 1 ? "" : "s"}. Use H3 subsections or paragraphs for any additional detail.`;
  return `${expansionPass
    ? "Expand the existing SEO article below with new, useful in-article content. Return only the new Markdown that should be appended."
    : "Continue and finish the existing SEO article below. Return only the new Markdown that should be appended."}

RECOVERY RULES
- Bring the combined article to ${numberLabel(targetMinimumWords)}–${numberLabel(targetMaximumWords)} total words through useful coverage, not padding.
- The existing article already contains ${numberLabel(existingWordCount)} words. ${wordBudgetRule}
- Return only article Markdown. Never return commentary about the article, its completeness, or this task.
- Do not repeat the H1, introduction, completed sections, or existing paragraphs.
- The existing article already contains ${numberLabel(existingH2Count)} H2 sections. The combined SEO article must stay within Rebound SEO's Logos policy of 6–9 H2 sections. ${h2BudgetRule}
- If the draft ends mid-sentence, begin with a complete replacement sentence or paragraph. Do not continue a broken fragment.
- Complete the missing H2/H3 sections, practical examples, FAQ, answer-first summary, and final call to action where they are not already present.
- Keep paragraphs to four sentences or fewer and preserve the established voice.
- Use only URLs already present in the article or the verified evidence pack. Never invent facts, statistics, sources, links, customer stories, or first-person experience.
- End with a complete sentence. Do not return JSON, commentary, a preface, or Markdown fences.

VERIFIED EVIDENCE PACK
${evidence || "No additional evidence was supplied. Do not add unsupported factual claims."}

EXISTING ARTICLE — DO NOT REPEAT
${existing}`;
}

export function buildAnthropicArticleContinuationRequest(prompt: string, model: string) {
  return {
    model,
    max_tokens: 7_000,
    messages: [{ role: "user", content: prompt }],
  };
}

// Deterministic refusal guard: a continuation that talks ABOUT the article
// instead of being article copy must never be merged. Rejecting here routes
// into the existing fail-closed recovery error path, which preserves the
// unpolluted draft and keeps it non-approvable.
// Openers that are refusals on their own, with no plausible article-copy reading.
// "No additional …" is NOT a standalone opener: legitimate copy can begin
// "No additional consent is necessary…". The refusal reading ("No additional
// content is needed") is covered by the contextual phrase fallback below.
// "Nothing …" stems must name an explicit completion action ("to add") —
// copy can legitimately open "Nothing more than a signed consent form…" or
// "There is nothing illegal about…". First-person inability stems stay
// standalone: article copy is never written in the writer's first person.
const CONTINUATION_REFUSAL_OPENERS = /^(?:(?:there is )?nothing (?:more |else |further )?(?:left )?to (?:add|append|write|expand|continue)|i cannot|i can't|i am unable|i'm unable|i won't|i will not)\b/i;
// Openers that merely reference the article; these are only refusals when the
// same opening line also carries completeness/refusal semantics, because
// legitimate copy can begin "This article helps hiring managers…".
const CONTINUATION_ARTICLE_OPENERS = /^(?:the (?:existing |current )?article|this article|the draft)\b/i;
// Every phrase must carry explicit completion/no-further-content semantics;
// generic fragments like "requires no" or a bare "no additional content"
// appear in legitimate domain prose and must not trip the fallback.
const CONTINUATION_REFUSAL_PHRASES = /\b(?:already complete|already meets the (?:word )?target|is complete as|complete as written|no additional content (?:is )?(?:needed|required|necessary)|no (?:additional|further) content should be (?:added|appended)|nothing (?:more |else )?(?:to|should be) (?:add|append)(?:ed|ing)?|should be appended|does not need (?:additional|more|further|new|expansion)|(?:cannot|requires no) (?:be )?(?:further )?(?:add|expand|extend|expansion)(?:ed|ing)?s?\b)/i;

export function isContinuationRefusal(value: string) {
  const opening = value.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  if (CONTINUATION_REFUSAL_OPENERS.test(opening)) return true;
  if (CONTINUATION_ARTICLE_OPENERS.test(opening) && CONTINUATION_REFUSAL_PHRASES.test(opening)) return true;
  const wordCount = markdownWordCount(value);
  const hasHeading = /^ {0,3}#{1,6}\s+/m.test(value);
  return wordCount < 60 && !hasHeading && CONTINUATION_REFUSAL_PHRASES.test(value);
}

export function parseArticleContinuation(raw: string) {
  const fenced = /^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i.exec(raw.trim())?.[1];
  const value = (fenced ?? raw).trim();
  if (!value) throw new Error("Claude returned an empty continuation.");
  if (/^\s*[{[]/.test(value)) throw new Error("Claude did not return the continuation as plain Markdown.");
  const cleaned = value.replace(/^\s*(?:Here(?:'s| is) the continuation:?|Continuation:)\s*/i, "").trim();
  if (isContinuationRefusal(cleaned)) throw new Error("Claude returned commentary about the article instead of a continuation.");
  return cleaned;
}

function trimIncompleteTail(markdown: string) {
  const value = markdown.trimEnd();
  if (articleHasCleanEnding(value)) return value;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (value[index] === "." || value[index] === "!" || value[index] === "?") {
      return value.slice(0, index + 1).trimEnd();
    }
  }

  // A provider can stop inside one long paragraph before producing any
  // sentence punctuation. In that case there is no reliable sentence boundary
  // to retain. Drop a small trailing window so the continuation starts from a
  // clean replacement sentence instead of preserving a visibly broken phrase.
  const trailingWords = [...value.matchAll(/\S+/g)];
  if (trailingWords.length <= 24) return value;
  const recoveryWindow = Math.min(20, trailingWords.length - 1);
  const cutoff = trailingWords.at(-recoveryWindow)?.index;
  return typeof cutoff === "number" ? value.slice(0, cutoff).trimEnd() : value;
}

function stripRepeatedHeading(markdown: string) {
  return markdown.replace(/^\s*#\s+[^\n]+\n+/i, "").trim();
}

function normalizedLine(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function removeLineOverlap(existing: string, continuation: string) {
  const existingLines = existing.split("\n");
  const continuationLines = continuation.split("\n");
  while (existingLines.at(-1)?.trim() === "") existingLines.pop();
  while (continuationLines[0]?.trim() === "") continuationLines.shift();
  const maximum = Math.min(8, existingLines.length, continuationLines.length);
  for (let count = maximum; count > 0; count -= 1) {
    const tail = existingLines.slice(-count).map(normalizedLine);
    const head = continuationLines.slice(0, count).map(normalizedLine);
    if (tail.every((line, index) => line && line === head[index])) {
      return continuationLines.slice(count).join("\n").trim();
    }
  }
  return continuationLines.join("\n").trim();
}

// Deterministic guarantee: a finishing pass can never push the combined
// article past the H2 limit, regardless of what the model returns. Any new
// H2 heading beyond the remaining budget is demoted to an H3 subsection,
// which preserves the content and keeps heading levels contiguous (the
// demoted section always follows an existing H2).
export function clampContinuationHeadings(existingMarkdown: string, continuationMarkdown: string) {
  const remaining = Math.max(0, SEO_ARTICLE_H2_LIMIT - countH2Sections(existingMarkdown));
  const excessIndexes = new Set(scanArticleH2LineIndexes(continuationMarkdown).slice(remaining));
  if (excessIndexes.size === 0) return continuationMarkdown;
  return continuationMarkdown.split("\n").map((line, index) => (
    excessIndexes.has(index) ? line.replace(/^( {0,3})##/, "$1###") : line
  )).join("\n");
}

export function mergeArticleContinuation(bodyMarkdown: string, continuationMarkdown: string) {
  const existing = trimIncompleteTail(bodyMarkdown);
  const continuation = removeLineOverlap(existing, stripRepeatedHeading(parseArticleContinuation(continuationMarkdown)));
  if (!continuation) return existing;
  return `${existing}\n\n${clampContinuationHeadings(existing, continuation)}`.trim();
}
