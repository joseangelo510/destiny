import { describe, expect, it, vi } from "vitest";
import { prepareWebflowDraft } from "@/lib/cms/webflow-draft";
import { prepareWordPressDraft } from "@/lib/cms/wordpress-draft";
import { createOfflineCmsHarness } from "./cms-adapters";

const titleCandidates = ["numbered", "how_to", "second_person", "question", "descriptive", "benefit"]
  .map((format, index) => ({
    format,
    headline: `Candidate ${index + 1}`,
    metaTitle: `Background Check Services Candidate ${index + 1} Guide`,
    score: 90 - index,
    rationale: "Accurate.",
  }));

const approvedArticle = {
  websiteId: "website-smoke",
  auditId: "audit-smoke",
  keyword: "background check services",
  title: "Background Check Services: A Practical Guide",
  metaTitle: "Background Check Services: A Practical Guide",
  titleCandidates,
  body: `# Background Check Services: A Practical Guide\n\n${"A useful paragraph about selecting an accurate background check service. ".repeat(4)}\n\n## What to compare\n\n- Accuracy\n- Turnaround time`,
  metaDescription: "Compare background check services with clear evidence.",
  approved: true,
  generationStatus: "generated",
};

describe("offline CMS adapter harness", () => {
  it("runs production preparation into deterministic WordPress and Webflow draft mocks", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network must stay offline"));
    const harness = createOfflineCmsHarness();

    const wordpressPrepared = prepareWordPressDraft(approvedArticle);
    const webflowPrepared = prepareWebflowDraft(approvedArticle);
    const wordpress = await harness.transfer("wordpress", "https://wordpress.qa.invalid", wordpressPrepared);
    const webflow = await harness.transfer("webflow", "https://webflow.qa.invalid", webflowPrepared);
    const wordpressDuplicate = await harness.transfer("wordpress", "https://wordpress.qa.invalid", wordpressPrepared);

    expect(wordpress).toMatchObject({ provider: "wordpress", state: "draft_created" });
    expect(webflow).toMatchObject({ provider: "webflow", state: "draft_created" });
    expect(wordpress.editorUrl).toMatch(/^https:\/\/wordpress\.qa\.invalid\//);
    expect(webflow.editorUrl).toMatch(/^https:\/\/webflow\.qa\.invalid\//);
    expect(wordpressDuplicate).toEqual(wordpress);
    expect(harness.evidence()).toHaveLength(2);
    expect(network).not.toHaveBeenCalled();
    network.mockRestore();
  });

  it("keeps Wix as an explicit manual handoff", async () => {
    const harness = createOfflineCmsHarness();
    const result = await harness.transfer("wix", "https://wix.qa.invalid", {
      websiteId: approvedArticle.websiteId,
      articleKey: `${approvedArticle.auditId}:${approvedArticle.keyword}`,
      title: approvedArticle.title,
      contentHtml: "<p>Prepared for a user-reviewed manual Wix handoff.</p>",
    });

    expect(result).toMatchObject({
      provider: "wix",
      state: "manual_handoff_required",
      editorUrl: null,
    });
  });

  it.each([
    "https://clearcheck.app",
    "https://blog.clearcheck.app",
    "https://98junkit.com",
    "https://joseangelostudios.com",
    "https://example.com",
  ])("refuses a live destination before recording evidence: %s", async (destination) => {
    const harness = createOfflineCmsHarness();
    await expect(harness.transfer("wordpress", destination, prepareWordPressDraft(approvedArticle)))
      .rejects.toThrow(/offline cms harness/i);
    expect(harness.evidence()).toEqual([]);
  });
});
