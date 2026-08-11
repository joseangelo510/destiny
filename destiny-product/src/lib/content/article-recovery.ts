import { markdownWordCount, type ArticleFormat } from "./article-generation";

export type ArticleContinuationReason = "max_tokens" | "short" | "unclean" | "short_and_unclean";

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
}: {
  bodyMarkdown: string;
  researchEvidence: string;
  targetMinimumWords: number;
  targetMaximumWords: number;
}) {
  const existing = bodyMarkdown.trim().slice(-20_000);
  const evidence = researchEvidence.trim().slice(0, 12_000);
  return `Continue and finish the existing SEO article below. Return only the new Markdown that should be appended.

RECOVERY RULES
- Bring the combined article to ${numberLabel(targetMinimumWords)}–${numberLabel(targetMaximumWords)} total words through useful coverage, not padding.
- Do not repeat the H1, introduction, completed sections, or existing paragraphs.
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

export function parseArticleContinuation(raw: string) {
  const fenced = /^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i.exec(raw.trim())?.[1];
  const value = (fenced ?? raw).trim();
  if (!value) throw new Error("Claude returned an empty continuation.");
  if (/^\s*[{[]/.test(value)) throw new Error("Claude did not return the continuation as plain Markdown.");
  return value.replace(/^\s*(?:Here(?:'s| is) the continuation:?|Continuation:)\s*/i, "").trim();
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

export function mergeArticleContinuation(bodyMarkdown: string, continuationMarkdown: string) {
  const existing = trimIncompleteTail(bodyMarkdown);
  const continuation = removeLineOverlap(existing, stripRepeatedHeading(parseArticleContinuation(continuationMarkdown)));
  if (!continuation) return existing;
  return `${existing}\n\n${continuation}`.trim();
}
