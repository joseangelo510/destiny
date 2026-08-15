import { renderArticleMarkdownToHtml } from "@/lib/content/article-draft";
import { articleTitleQualityIssues, renderFeaturedImageSvg, renderInfographicSvg, type InfographicSpec } from "@/lib/content/article-generation";

export type WordPressDraftRequest = {
  websiteId?: unknown;
  auditId?: unknown;
  keyword?: unknown;
  title?: unknown;
  metaTitle?: unknown;
  titleCandidates?: unknown;
  body?: unknown;
  metaDescription?: unknown;
  infographics?: unknown;
  approved?: unknown;
  generationStatus?: unknown;
};

function slug(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLocaleLowerCase();
}

function articleHeadings(markdown: string) {
  return markdown.split("\n").flatMap((line) => {
    const match = /^#{2,3}\s+(.+?)\s*$/.exec(line);
    return match ? [match[1].replace(/[*_`]/g, "").trim()] : [];
  });
}

function prepareInfographics(value: unknown, headings: string[]) {
  if (!Array.isArray(value)) return [] as Array<{ name: string; svg: string; alt: string; role: "inline"; caption: string; placementAfterHeading: string }>;
  return value.slice(0, 3).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const graphic = entry as Partial<InfographicSpec>;
    if (typeof graphic.title !== "string" || !graphic.title.trim() || typeof graphic.altText !== "string" || !graphic.altText.trim()) return [];
    if (typeof graphic.insight !== "string" || !Array.isArray(graphic.items) || typeof graphic.sourceLabel !== "string") return [];
    const spec: InfographicSpec = {
      id: typeof graphic.id === "string" && graphic.id.trim() ? graphic.id.trim() : `graphic-${index + 1}`,
      template: graphic.template === "comparison" || graphic.template === "stat" || graphic.template === "timeline" || graphic.template === "checklist" ? graphic.template : "steps",
      title: graphic.title.trim(),
      insight: graphic.insight.trim(),
      items: graphic.items.filter((item): item is string => typeof item === "string").slice(0, 8),
      sourceLabel: graphic.sourceLabel.trim(),
      altText: graphic.altText.trim(),
      placementAfterHeading: typeof graphic.placementAfterHeading === "string" ? graphic.placementAfterHeading.trim() : "",
      caption: typeof graphic.caption === "string" ? graphic.caption.trim() : "",
    };
    const placementAfterHeading = spec.placementAfterHeading || headings[index] || headings[0] || "";
    return [{
      name: slug(spec.id) || `graphic-${index + 1}`,
      svg: renderInfographicSvg(spec),
      alt: spec.altText,
      role: "inline" as const,
      caption: spec.caption || spec.sourceLabel,
      placementAfterHeading,
    }];
  });
}

function wordpressArticleBlocks(contentHtml: string) {
  const blocks = Array.from(contentHtml.matchAll(/<(h[2-6]|p|ul|ol|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi)).map((match) => {
    const tag = match[1].toLocaleLowerCase();
    let html = match[0];
    if (tag === "p") {
      const callout = /^<p><strong>(Practical tip|A worked example|Worked example|Key takeaway|Why this matters):<\/strong>/i.test(html);
      if (callout) html = html.replace(/^<p>/, '<p class="destiny-callout">');
      return `<!-- wp:paragraph${callout ? ' {"className":"destiny-callout"}' : ""} -->${html}<!-- /wp:paragraph -->`;
    }
    if (/^h[2-6]$/.test(tag)) return `<!-- wp:heading {"level":${tag.slice(1)}} -->${html}<!-- /wp:heading -->`;
    if (tag === "ul") return `<!-- wp:list -->${html}<!-- /wp:list -->`;
    if (tag === "ol") return `<!-- wp:list {"ordered":true} -->${html}<!-- /wp:list -->`;
    return `<!-- wp:quote -->${html}<!-- /wp:quote -->`;
  }).join("");
  return `<!-- wp:group {"className":"destiny-article"} --><div class="wp-block-group destiny-article">${blocks}</div><!-- /wp:group -->`;
}

export function prepareWordPressDraft(input: WordPressDraftRequest) {
  if (typeof input.websiteId !== "string" || !input.websiteId.trim()) {
    throw new Error("Complete onboarding before sending an article to WordPress.");
  }
  if (input.approved !== true || input.generationStatus !== "generated") {
    throw new Error("Approve the completed article before sending it to WordPress.");
  }

  const auditId = typeof input.auditId === "string" ? input.auditId.trim() : "";
  const keyword = typeof input.keyword === "string" ? input.keyword.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const metaTitle = typeof input.metaTitle === "string" && input.metaTitle.trim() ? input.metaTitle.trim().slice(0, 160) : title;
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const excerpt = typeof input.metaDescription === "string" ? input.metaDescription.trim().slice(0, 280) : "";
  if (!auditId || !keyword || !title || body.length < 100) {
    throw new Error("The approved article is incomplete. Review it before sending it to WordPress.");
  }
  const titleIssues = articleTitleQualityIssues({ title, metaTitle, titleCandidates: input.titleCandidates, bodyMarkdown: body }, keyword);
  if (titleIssues.length) throw new Error(`Review the headline and SEO/meta title before sending this article: ${titleIssues[0].message}`);

  const renderedHtml = renderArticleMarkdownToHtml(body).replace(/^<h1>.*?<\/h1>/, "");
  const contentHtml = wordpressArticleBlocks(renderedHtml);
  if (!contentHtml) throw new Error("The approved article has no content to send.");

  const featuredName = `${slug(title) || "destiny-article"}-featured`;
  const featuredGraphic = {
    name: featuredName,
    svg: renderFeaturedImageSvg(title, keyword),
    alt: `${title} featured image`,
    role: "featured" as const,
    caption: "",
    placementAfterHeading: "",
  };

  return {
    websiteId: input.websiteId.trim(),
    articleKey: `${auditId}:${keyword}`.slice(0, 500),
    title,
    metaTitle,
    contentHtml,
    excerpt,
    featuredGraphic,
    graphics: prepareInfographics(input.infographics, articleHeadings(body)),
  };
}
