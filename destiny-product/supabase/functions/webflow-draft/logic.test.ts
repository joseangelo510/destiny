import { describe, expect, it } from "vitest";
import {
  PENDING_LEASE_MS,
  applyImageFallbackToReport,
  canReclaimPendingTransfer,
  classifyWebflowFailure,
  embedGraphicsInBody,
  establishedFieldValues,
  findItemIdBySlug,
  planWebflowFieldData,
  prepareDraftBody,
  readingTimeMinutes,
  stripEmbeddedGraphics,
  stripImageFieldData,
  webflowCollectionEndpoint,
  webflowCreateItemEndpoint,
  webflowEditUrl,
  webflowItemPayload,
  webflowItemSlug,
  webflowListItemsEndpoint,
  webflowUpdateItemEndpoint,
  type WebflowFieldSchema,
} from "./logic";

const draft = prepareDraftBody({
  websiteId: "website-1",
  articleKey: "audit-1:junk removal",
  title: "A Useful Article",
  metaTitle: "A Useful Article | Practical Guide",
  contentHtml: `<p>${"Safe article content. ".repeat(8)}</p>`,
  metaDescription: "A concise meta description for the article.",
  wordCount: 2350,
  graphics: [{ name: "graphic-1", svg: "<svg xmlns='http://www.w3.org/2000/svg'></svg>", alt: "Steps to vet a provider" }],
});

// The exact Blog Posts schema observed in the live acceptance test.
const blogPostFields: WebflowFieldSchema[] = [
  { slug: "name", displayName: "Name", type: "PlainText", isEditable: true, isRequired: true },
  { slug: "slug", displayName: "Slug", type: "PlainText", isEditable: true, isRequired: true },
  { slug: "post-body", displayName: "Post Body", type: "RichText", isEditable: true },
  { slug: "post-summary", displayName: "Post Summary", type: "PlainText", isEditable: true },
  { slug: "main-image", displayName: "Main Image", type: "Image", isEditable: true },
  { slug: "thumbnail-image", displayName: "Thumbnail image", type: "Image", isEditable: true },
  { slug: "featured", displayName: "Featured?", type: "Switch", isEditable: true },
  { slug: "color", displayName: "Color", type: "Color", isEditable: true },
  { slug: "author-avatar", displayName: "Author Avatar", type: "Image", isEditable: true },
  { slug: "author-name", displayName: "Author Name", type: "PlainText", isEditable: true },
  { slug: "publish-date", displayName: "Publish Date", type: "DateTime", isEditable: true },
  { slug: "min-to-read-put-the-number-only", displayName: "Min to read (put the number only)", type: "Number", isEditable: true },
  { slug: "category", displayName: "Category", type: "Option", isEditable: true, validations: { options: [{ id: "opt-guides", name: "Guides" }, { id: "opt-news", name: "News" }] } },
];

const article = {
  title: draft.title,
  metaTitle: draft.metaTitle,
  contentHtml: draft.contentHtml,
  metaDescription: draft.metaDescription,
  wordCount: draft.wordCount,
  publishDateIso: "2026-08-13T12:00:00.000Z",
  graphics: [{ url: "https://cdn.example.com/graphic-1.svg", alt: "Steps to vet a provider" }],
};

const established = {
  "author-name": "Dana Reviewer",
  "author-avatar": { url: "https://cdn.example.com/avatar.png" },
  category: "opt-guides",
};

function plan(overrides: Partial<Parameters<typeof planWebflowFieldData>[0]> = {}) {
  return planWebflowFieldData({
    fields: blogPostFields,
    titleField: "name",
    bodyField: "post-body",
    article,
    established,
    slug: webflowItemSlug(draft.title, draft.articleKey),
    includeSlug: true,
    ...overrides,
  });
}

describe("Webflow draft Edge Function logic", () => {
  it("maps a separate SEO/meta title only when the collection exposes a matching field", () => {
    const { fieldData, report } = plan({ fields: [...blogPostFields, { slug: "seo-title", displayName: "SEO Title", type: "PlainText", isEditable: true }] });
    expect(fieldData["seo-title"]).toBe(article.metaTitle);
    expect(report).toContainEqual(expect.objectContaining({ label: "SEO Title", status: "transferred" }));
  });
  it("always creates draft items — publishing is structurally impossible", () => {
    const payload = webflowItemPayload(plan().fieldData);
    expect(payload.isDraft).toBe(true);
    expect(payload.isArchived).toBe(false);
    expect(payload).not.toHaveProperty("publish");
    expect(payload.fieldData).toMatchObject({ name: "A Useful Article", "post-body": draft.contentHtml });
    for (const endpoint of [webflowCreateItemEndpoint("col-1"), webflowUpdateItemEndpoint("col-1", "item-1"), webflowCollectionEndpoint("col-1"), webflowListItemsEndpoint("col-1")]) {
      expect(endpoint).not.toContain("live");
      expect(endpoint).not.toContain("publish");
    }
    expect(webflowCreateItemEndpoint("col-1")).toBe("https://api.webflow.com/v2/collections/col-1/items");
    expect(webflowUpdateItemEndpoint("col-1", "item-1")).toBe("https://api.webflow.com/v2/collections/col-1/items/item-1");
  });

  it("populates every compatible Blog Posts field — the live acceptance gap", () => {
    const { fieldData, report } = plan();
    expect(fieldData["post-summary"]).toBe(article.metaDescription);
    expect(fieldData["main-image"]).toEqual({ url: article.graphics[0].url, alt: article.graphics[0].alt });
    expect(fieldData["thumbnail-image"]).toEqual({ url: article.graphics[0].url, alt: article.graphics[0].alt });
    expect(fieldData["author-name"]).toBe("Dana Reviewer");
    expect(fieldData["author-avatar"]).toEqual({ url: "https://cdn.example.com/avatar.png" });
    expect(fieldData["publish-date"]).toBe(article.publishDateIso);
    expect(fieldData["min-to-read-put-the-number-only"]).toBe(readingTimeMinutes(article.wordCount));
    expect(fieldData.category).toBe("opt-guides");
    const transferred = report.filter((entry) => entry.status === "transferred").map((entry) => entry.field);
    for (const slug of ["name", "slug", "post-body", "post-summary", "main-image", "thumbnail-image", "author-name", "author-avatar", "publish-date", "min-to-read-put-the-number-only", "category"]) {
      expect(transferred).toContain(slug);
    }
    // Fields Destiny has no content for stay untouched but are reported.
    expect(fieldData).not.toHaveProperty("featured");
    expect(fieldData).not.toHaveProperty("color");
    expect(report.find((entry) => entry.field === "featured")?.status).toBe("needs_review");
    expect(report.find((entry) => entry.field === "color")?.status).toBe("needs_review");
  });

  it("is truthful about missing optional values instead of guessing", () => {
    const { fieldData, report } = plan({ established: {}, article: { ...article, metaDescription: "", graphics: [] } });
    for (const slug of ["post-summary", "main-image", "thumbnail-image", "author-name", "author-avatar", "category"]) {
      expect(fieldData).not.toHaveProperty(slug);
      expect(report.find((entry) => entry.field === slug)?.status).toBe("needs_review");
    }
    // Never a hard-coded cross-client guess for author or category.
    expect(JSON.stringify(fieldData)).not.toMatch(/destiny|admin|default/i);
  });

  it("reports Destiny values with no matching collection field as unavailable", () => {
    const minimalFields = blogPostFields.filter((field) => ["name", "slug", "post-body"].includes(field.slug as string));
    const { report } = plan({ fields: minimalFields });
    expect(report.find((entry) => entry.label === "Meta description")?.status).toBe("unavailable");
    expect(report.find((entry) => entry.label === "Article graphics")?.status).toBe("unavailable");
  });

  it("survives schema drift: renamed fields are skipped and reported, never written blind", () => {
    const drifted = blogPostFields.map((field) => field.slug === "post-summary" ? { ...field, slug: "blurb-text", displayName: "Blurb" } : field);
    const { fieldData, report } = plan({ fields: drifted });
    expect(fieldData).not.toHaveProperty("post-summary");
    // "Blurb" has no summary semantics, so the meta description is honestly unavailable.
    expect(report.find((entry) => entry.label === "Meta description")?.status).toBe("unavailable");
  });

  it("maps the separate meta title without writing the description into look-alike fields", () => {
    const trickyFields = [
      ...blogPostFields,
      { slug: "meta-keywords", displayName: "Meta Keywords", type: "PlainText", isEditable: true },
      { slug: "seo-title", displayName: "SEO Title", type: "PlainText", isEditable: true },
      { slug: "author-description", displayName: "Author Description", type: "PlainText", isEditable: true },
    ];
    const { fieldData, report } = plan({ fields: trickyFields });
    expect(fieldData["post-summary"]).toBe(article.metaDescription);
    expect(fieldData["seo-title"]).toBe(article.metaTitle);
    expect(report.find((entry) => entry.field === "seo-title")?.status).toBe("transferred");
    for (const slug of ["meta-keywords", "author-description"]) {
      expect(fieldData).not.toHaveProperty(slug);
      expect(report.find((entry) => entry.field === slug)?.status).toBe("needs_review");
    }
  });

  it("treats a pending transfer as an expiring lease, never a permanent lock", () => {
    const now = Date.parse("2026-08-13T12:00:00.000Z");
    const fresh = new Date(now - 30_000).toISOString();
    const stale = new Date(now - PENDING_LEASE_MS - 1_000).toISOString();
    expect(canReclaimPendingTransfer(fresh, now)).toBe(false);
    expect(canReclaimPendingTransfer(stale, now)).toBe(true);
    // Unparseable or missing timestamps must not wedge the article forever.
    expect(canReclaimPendingTransfer(undefined, now)).toBe(true);
    expect(canReclaimPendingTransfer("not-a-date", now)).toBe(true);
  });

  it("only maps category to an option that exists in the collection", () => {
    expect(plan({ established: { ...established, category: "opt-removed" } }).fieldData).not.toHaveProperty("category");
    // A configured default may use the option name; it resolves to the id.
    expect(plan({ established: { ...established, category: "Guides" } }).fieldData.category).toBe("opt-guides");
  });

  it("keeps the slug stable and collision-safe, and never sends a slug on updates", () => {
    expect(webflowItemSlug(draft.title, draft.articleKey)).toBe(webflowItemSlug(draft.title, draft.articleKey));
    expect(webflowItemSlug(draft.title, draft.articleKey)).toMatch(/^a-useful-article-[a-z0-9]+$/);
    expect(webflowItemSlug(draft.title, "other-key")).not.toBe(webflowItemSlug(draft.title, draft.articleKey));
    expect(webflowItemSlug("###", "key")).toMatch(/^destiny-article-/);
    const update = plan({ includeSlug: false });
    expect(update.fieldData).not.toHaveProperty("slug");
    expect(update.report.find((entry) => entry.field === "slug")?.note).toContain("Existing slug kept");
  });

  it("hashes stable field data so an unchanged article is reused, not re-sent for a new date", () => {
    const first = plan();
    const second = plan({ article: { ...article, publishDateIso: "2026-08-14T12:00:00.000Z" } });
    expect(JSON.stringify(first.stableFieldData)).toBe(JSON.stringify(second.stableFieldData));
    expect(first.stableFieldData).not.toHaveProperty("publish-date");
    expect(first.stableFieldData).toHaveProperty("post-body");
  });

  it("derives established author and category from existing collection items, most frequent wins", () => {
    const items = [
      { fieldData: { "author-name": "Dana Reviewer", category: "opt-guides" } },
      { fieldData: { "author-name": "Dana Reviewer", category: "opt-news" } },
      { fieldData: { "author-name": "Sam Writer", category: "opt-guides" } },
      { fieldData: { "author-name": "" } },
      {},
    ];
    const values = establishedFieldValues(items, ["author-name", "category", "author-avatar"]);
    expect(values["author-name"]).toBe("Dana Reviewer");
    expect(values.category).toBe("opt-guides");
    expect(values).not.toHaveProperty("author-avatar");
  });

  it("computes reading time from the article words", () => {
    expect(readingTimeMinutes(2350)).toBe(10);
    expect(readingTimeMinutes(225)).toBe(1);
    expect(readingTimeMinutes(80)).toBe(1);
    expect(readingTimeMinutes(0)).toBe(0);
  });

  it("strips only image fields for the external-image fallback", () => {
    const { fieldData, imageFieldSlugs } = plan();
    const stripped = stripImageFieldData(fieldData, imageFieldSlugs);
    expect(stripped).not.toHaveProperty("main-image");
    expect(stripped).not.toHaveProperty("thumbnail-image");
    expect(stripped).not.toHaveProperty("author-avatar");
    expect(stripped["post-summary"]).toBe(article.metaDescription);
    expect(stripped["post-body"]).toBe(draft.contentHtml);
  });

  it("recovers an orphaned item by its deterministic slug after a partial failure", () => {
    const slug = webflowItemSlug(draft.title, draft.articleKey);
    const items = [
      { id: "item-other", fieldData: { slug: "someone-elses-post" } },
      { id: "item-ours", fieldData: { slug } },
    ];
    expect(findItemIdBySlug(items, slug)).toBe("item-ours");
    expect(findItemIdBySlug(items, "missing-slug")).toBe("");
    expect(findItemIdBySlug([{ fieldData: { slug } }], slug)).toBe("");
  });

  it("rejects an incomplete draft and sanitizes optional inputs", () => {
    expect(() => prepareDraftBody({ websiteId: "website-1", articleKey: "key", title: "Title", contentHtml: "short" })).toThrow();
    expect(() => prepareDraftBody({ websiteId: "", articleKey: "key", title: "Title", contentHtml: "x".repeat(200) })).toThrow();
    const sanitized = prepareDraftBody({
      websiteId: "website-1", articleKey: "key", title: "Title", contentHtml: "x".repeat(200),
      metaDescription: 42, wordCount: "many",
      graphics: [{ svg: "not svg", alt: "alt" }, { svg: "<svg/>", alt: "" }, { svg: "<svg xmlns='x'></svg>", alt: "Good alt" }],
    });
    expect(sanitized.metaDescription).toBe("");
    expect(sanitized.wordCount).toBe(0);
    expect(sanitized.graphics).toHaveLength(1);
    expect(sanitized.graphics[0].alt).toBe("Good alt");
  });

  it("reuses an established referenced category for Reference and ItemRef fields", () => {
    for (const type of ["Reference", "ItemRef"]) {
      const fields = blogPostFields.map((field) => field.slug === "category" ? { slug: "category", displayName: "Category", type, isEditable: true } : field);
      const { fieldData, report } = plan({ fields, established: { ...established, category: "cat-item-background-check" } });
      expect(fieldData.category).toBe("cat-item-background-check");
      expect(report.find((entry) => entry.field === "category")?.status).toBe("transferred");
    }
    // Established values sampled as objects still resolve to the referenced item id.
    const refFields = blogPostFields.map((field) => field.slug === "category" ? { slug: "category", displayName: "Category", type: "Reference", isEditable: true } : field);
    expect(plan({ fields: refFields, established: { ...established, category: { _id: "cat-item-1" } } }).fieldData.category).toBe("cat-item-1");
  });

  it("never invents a referenced category when none is established", () => {
    const refFields = blogPostFields.map((field) => field.slug === "category" ? { slug: "category", displayName: "Category", type: "Reference", isEditable: true } : field);
    const { fieldData, report } = plan({ fields: refFields, established: { "author-name": "Dana Reviewer" } });
    expect(fieldData).not.toHaveProperty("category");
    expect(report.find((entry) => entry.field === "category")?.status).toBe("needs_review");
    expect(JSON.stringify(fieldData)).not.toMatch(/background|destiny-default/i);
  });

  const sectionedHtml = [
    "<h2>Introduction</h2><p>Opening paragraph.</p>",
    "<h2>How it works</h2><ol><li>First</li><li>Second</li></ol>",
    "<h2>What to check</h2><ul><li>One</li><li>Two</li></ul><p>See <a href=\"https://example.com\">the guide</a>.</p>",
    "<h2>Conclusion</h2><p>Closing paragraph.</p>",
  ].join("");
  const extraGraphics = [
    { url: "https://cdn.example.com/graphic-2.svg", alt: "Cost comparison chart" },
    { url: "https://cdn.example.com/graphic-3.svg", alt: "Vetting checklist" },
  ];

  it("inserts additional graphics as captioned figures at H2 boundaries, preserving structure", () => {
    const body = embedGraphicsInBody(sectionedHtml, extraGraphics);
    const figures = body.match(/<figure class="destiny-article-graphic">/g) ?? [];
    expect(figures).toHaveLength(2);
    expect(body).toContain('<img src="https://cdn.example.com/graphic-2.svg" alt="Cost comparison chart"');
    expect(body).toContain("<figcaption>Vetting checklist</figcaption>");
    // Figures land immediately before later H2 headings, never before the intro.
    expect(body.indexOf("<figure")).toBeGreaterThan(body.indexOf("<h2>Introduction</h2>"));
    expect(/<\/figure><h2>/.test(body)).toBe(true);
    // Headings, ordered/bulleted lists, and links survive untouched.
    for (const fragment of ["<h2>How it works</h2>", "<ol><li>First</li>", "<ul><li>One</li>", '<a href="https://example.com">the guide</a>', "<h2>Conclusion</h2>"]) {
      expect(body).toContain(fragment);
    }
    expect(stripEmbeddedGraphics(body)).toBe(sectionedHtml);
  });

  it("appends a separated visual section when no suitable H2 boundaries exist", () => {
    const flat = "<p>" + "Just paragraphs of prose. ".repeat(5) + "</p>";
    const body = embedGraphicsInBody(flat, extraGraphics);
    expect(body.startsWith(flat)).toBe(true);
    expect(body.match(/<figure class="destiny-article-graphic">/g)).toHaveLength(2);
    expect(embedGraphicsInBody(flat, [])).toBe(flat);
  });

  it("escapes alt text and captions in embedded figures", () => {
    const body = embedGraphicsInBody(sectionedHtml, [{ url: "https://cdn.example.com/g.svg", alt: 'Costs <up> & "down"' }]);
    expect(body).toContain('alt="Costs &lt;up&gt; &amp; &quot;down&quot;"');
    expect(body).toContain("<figcaption>Costs &lt;up&gt; &amp; &quot;down&quot;</figcaption>");
    expect(body).not.toContain("<up>");
  });

  it("embeds graphics beyond the first into the body and reports them as transferred", () => {
    const richArticle = { ...article, contentHtml: sectionedHtml, graphics: [article.graphics[0], ...extraGraphics] };
    const { fieldData, report, embeddedGraphicCount } = plan({ article: richArticle });
    expect(embeddedGraphicCount).toBe(2);
    expect(fieldData["main-image"]).toEqual({ url: article.graphics[0].url, alt: article.graphics[0].alt });
    const bodyHtml = String(fieldData["post-body"]);
    expect(bodyHtml.match(/<figure class="destiny-article-graphic">/g)).toHaveLength(2);
    expect(bodyHtml).not.toContain(article.graphics[0].url);
    const extras = report.find((entry) => entry.label === "Additional graphics (2)");
    expect(extras?.status).toBe("transferred");
    expect(extras?.note).toContain("Inserted into the article body");
    expect(extras?.note).not.toMatch(/manual|download/i);
  });

  it("hashes embedded-graphics bodies stably across days", () => {
    const richArticle = { ...article, contentHtml: sectionedHtml, graphics: [article.graphics[0], ...extraGraphics] };
    const first = plan({ article: richArticle });
    const second = plan({ article: { ...richArticle, publishDateIso: "2026-08-14T12:00:00.000Z" } });
    expect(JSON.stringify(first.stableFieldData)).toBe(JSON.stringify(second.stableFieldData));
  });

  it("strips embedded figures for the image fallback without touching other markup", () => {
    const richArticle = { ...article, contentHtml: sectionedHtml, graphics: [article.graphics[0], ...extraGraphics] };
    const { fieldData, imageFieldSlugs } = plan({ article: richArticle });
    const strippedBody = stripEmbeddedGraphics(String(fieldData["post-body"]));
    expect(strippedBody).toBe(sectionedHtml);
    const stripped = stripImageFieldData(fieldData, imageFieldSlugs);
    expect(stripped).not.toHaveProperty("main-image");
    expect(stripped["post-summary"]).toBe(article.metaDescription);
  });

  it("never promotes a later graphic to the image fields when the first fails to host", () => {
    const richArticle = { ...article, contentHtml: sectionedHtml, graphics: [null, ...extraGraphics] };
    const { fieldData, report, embeddedGraphicCount } = plan({ article: richArticle });
    expect(fieldData).not.toHaveProperty("main-image");
    expect(fieldData).not.toHaveProperty("thumbnail-image");
    expect(report.find((entry) => entry.field === "main-image")?.status).toBe("needs_review");
    // Both surviving graphics stay in the body, in their original order.
    expect(embeddedGraphicCount).toBe(2);
    const bodyHtml = String(fieldData["post-body"]);
    expect(bodyHtml.indexOf("graphic-2.svg")).toBeGreaterThan(-1);
    expect(bodyHtml.indexOf("graphic-2.svg")).toBeLessThan(bodyHtml.indexOf("graphic-3.svg"));
  });

  it("downgrades image fields and embedded figures truthfully after the image fallback", () => {
    const richArticle = { ...article, contentHtml: sectionedHtml, graphics: [article.graphics[0], ...extraGraphics] };
    const { report, imageFieldSlugs, embeddedGraphicCount } = plan({ article: richArticle });
    const downgraded = applyImageFallbackToReport(report, imageFieldSlugs, embeddedGraphicCount);
    for (const slug of ["main-image", "thumbnail-image", "author-avatar"]) {
      expect(downgraded.find((entry) => entry.field === slug)?.status).toBe("needs_review");
    }
    const extras = downgraded.find((entry) => entry.label === "Additional graphics (2)");
    expect(extras?.status).toBe("needs_review");
    expect(extras?.note).toMatch(/download/i);
    // Non-image entries keep their delivered status.
    expect(downgraded.find((entry) => entry.field === "post-summary")?.status).toBe("transferred");
    expect(downgraded.find((entry) => entry.field === "name")?.status).toBe("transferred");
  });

  it("classifies API failures and builds the review link", () => {
    expect(classifyWebflowFailure(401)).toBe("authorization_failed");
    expect(classifyWebflowFailure(403)).toBe("authorization_failed");
    expect(classifyWebflowFailure(422)).toBe("webflow_rejected");
    expect(classifyWebflowFailure(500)).toBe("webflow_rejected");
    expect(webflowEditUrl("my-site")).toBe("https://webflow.com/design/my-site");
    expect(webflowEditUrl("")).toBe("https://webflow.com/dashboard");
  });
});
