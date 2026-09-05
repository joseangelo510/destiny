import { describe, expect, it } from "vitest";
import { buildContentPipeline } from "./core-pages";

describe("content plan handoff", () => {
  it("keeps an empty starter in Ideas with a writing action, not a review task", () => {
    const pipeline = buildContentPipeline({ approvedKeywords: [{ keyword: "ads cost" }], drafts: [{ id: "saved-brief", keyword: "ads cost", draft: { title: "Ads cost", generationStatus: "starter", body: "", approved: false } }], scheduleItems: [], receipts: [] });
    expect(pipeline.items).toHaveLength(1);
    expect(pipeline.items[0]).toMatchObject({ id: "saved-brief", state: "idea", detail: "Brief saved", moveLabel: "Start draft", href: "/content?keyword=ads%20cost#article-review-workspace", needsUser: false });
    expect(pipeline.stats.needsUser).toBe(0);
  });
  it("does not demote an article with a saved body, even if its status is starter", () => {
    const pipeline = buildContentPipeline({ approvedKeywords: [], drafts: [{ id: "saved-article", keyword: "ads cost", draft: { generationStatus: "starter", body: "User-written article", approved: false } }], scheduleItems: [], receipts: [] });
    expect(pipeline.items[0]).toMatchObject({ state: "draft", moveLabel: "Review", needsUser: true });
  });
});
