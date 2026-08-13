import { describe, expect, it } from "vitest";
import {
  classifyWebflowFailure,
  prepareDraftBody,
  webflowCreateItemEndpoint,
  webflowEditUrl,
  webflowItemPayload,
  webflowItemSlug,
} from "./logic";

const draft = prepareDraftBody({
  websiteId: "website-1",
  articleKey: "audit-1:junk removal",
  title: "A Useful Article",
  contentHtml: `<p>${"Safe article content. ".repeat(8)}</p>`,
});

describe("Webflow draft Edge Function logic", () => {
  it("always creates draft items — publishing is structurally impossible", () => {
    const payload = webflowItemPayload(draft, "name", "post-body");
    expect(payload.isDraft).toBe(true);
    expect(payload.isArchived).toBe(false);
    expect(payload).not.toHaveProperty("publish");
    expect(payload.fieldData).toMatchObject({ name: "A Useful Article", "post-body": draft.contentHtml });
    // The staged-items endpoint only: never /items/live, never a publish endpoint.
    const endpoint = webflowCreateItemEndpoint("col-1");
    expect(endpoint).toBe("https://api.webflow.com/v2/collections/col-1/items");
    expect(endpoint).not.toContain("live");
    expect(endpoint).not.toContain("publish");
  });

  it("produces a deterministic slug so retries never duplicate items", () => {
    expect(webflowItemSlug(draft.title, draft.articleKey)).toBe(webflowItemSlug(draft.title, draft.articleKey));
    expect(webflowItemSlug(draft.title, draft.articleKey)).toMatch(/^a-useful-article-[a-z0-9]+$/);
    expect(webflowItemSlug(draft.title, "other-key")).not.toBe(webflowItemSlug(draft.title, draft.articleKey));
    expect(webflowItemSlug("###", "key")).toMatch(/^destiny-article-/);
  });

  it("rejects an incomplete draft", () => {
    expect(() => prepareDraftBody({ websiteId: "website-1", articleKey: "key", title: "Title", contentHtml: "short" })).toThrow();
    expect(() => prepareDraftBody({ websiteId: "", articleKey: "key", title: "Title", contentHtml: "x".repeat(200) })).toThrow();
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
