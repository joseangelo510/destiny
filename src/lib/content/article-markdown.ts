// Pure helpers for the Content Studio reading pane. The generated article is
// markdown; we render it as a readable document without pulling in a markdown
// dependency, so the preview cannot drift from what the Word export contains.

export type ArticleInlineToken =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "link"; text: string; url: string };

export type ArticleBlock =
  | { type: "heading"; level: 2 | 3; text: string; id: string }
  | { type: "paragraph"; tokens: ArticleInlineToken[] }
  | { type: "list"; ordered: boolean; items: ArticleInlineToken[][] };

export function articleHeadingId(text: string) {
  return `article-${text.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

// Only allow safe link protocols; anything else (javascript:, data:, …)
// renders as plain text instead of a clickable link.
export function safeArticleLinkUrl(url: string) {
  return /^(https?:\/\/|mailto:)/i.test(url.trim()) ? url.trim() : null;
}

export function parseArticleInline(text: string): ArticleInlineToken[] {
  const tokens: ArticleInlineToken[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let cursor = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > cursor) tokens.push({ type: "text", text: text.slice(cursor, match.index) });
    if (match[1] !== undefined && match[2] !== undefined) {
      const url = safeArticleLinkUrl(match[2]);
      if (url) tokens.push({ type: "link", text: match[1], url });
      else tokens.push({ type: "text", text: match[1] });
    }
    else if (match[3] !== undefined) tokens.push({ type: "strong", text: match[3] });
    else if (match[4] !== undefined) tokens.push({ type: "em", text: match[4] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) tokens.push({ type: "text", text: text.slice(cursor) });
  return tokens;
}

export function parseArticleMarkdown(markdown: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", tokens: parseArticleInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseArticleInline) });
    list = null;
  };

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph(); flushList();
      const text = heading[2].replace(/\*\*/g, "").trim();
      blocks.push({ type: "heading", level: heading[1].length >= 3 ? 3 : 2, text, id: articleHeadingId(text) });
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push((bullet?.[1] ?? numbered?.[1] ?? "").trim());
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  return blocks;
}

export function articleTableOfContents(markdown: string) {
  return parseArticleMarkdown(markdown)
    .filter((block): block is Extract<ArticleBlock, { type: "heading" }> => block.type === "heading" && block.level === 2)
    .map((block) => ({ id: block.id, text: block.text }));
}

export function estimatedReadMinutes(wordCount: number) {
  // Average adult reading speed is roughly 230 words per minute.
  return Math.max(1, Math.round(wordCount / 230));
}

// Truthful timed labels for the staged progress panel. The stages mirror the
// real request lifecycle (Claude researches with web search first, then
// writes), and the thresholds fit within the 280-second server-side budget.
export const GENERATION_STAGES = [
  { afterMs: 0, label: "Researching your topic…" },
  { afterMs: 25_000, label: "Reading sources…" },
  { afterMs: 70_000, label: "Writing your draft…" },
  { afterMs: 200_000, label: "Polishing headings and metadata…" },
] as const;

export function generationStageIndex(elapsedMs: number) {
  let index = 0;
  GENERATION_STAGES.forEach((stage, position) => { if (elapsedMs >= stage.afterMs) index = position; });
  return index;
}
