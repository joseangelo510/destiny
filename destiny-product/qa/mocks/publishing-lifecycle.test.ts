import { describe, expect, it, vi } from "vitest";
import { prepareWordPressDraft } from "@/lib/cms/wordpress-draft";
import { createOfflineCmsHarness } from "./cms-adapters";

const destination = "https://wordpress.qa.invalid";
const scheduledFor = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
const article = prepareWordPressDraft({
  websiteId: "website-publishing-lifecycle",
  auditId: "audit-publishing-lifecycle",
  keyword: "background check services",
  title: "How to Compare Background Check Services",
  metaTitle: "How to Compare Background Check Services",
  titleCandidates: [
    "how_to",
    "numbered",
    "second_person",
    "question",
    "descriptive",
    "benefit",
  ].map((format, index) => ({
    format,
    headline: index === 0 ? "How to Compare Background Check Services" : `Candidate ${index + 1}`,
    metaTitle: index === 0 ? "How to Compare Background Check Services" : `Background Check Services Candidate ${index + 1}`,
    score: 90 - index,
    rationale: "Accurate.",
  })),
  body: `# How to Compare Background Check Services\n\n${"A useful paragraph about accurate background check services and responsible hiring. ".repeat(5)}\n\n## Compare reliable evidence\n\n- Accuracy\n- Turnaround time`,
  metaDescription: "Compare background check services with clear evidence.",
  approved: true,
  generationStatus: "generated",
  scheduledFor,
});

describe("offline WordPress publishing lifecycle", () => {
  it("requires public proof before a scheduled article becomes verified live", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network must stay offline"));
    const harness = createOfflineCmsHarness();
    const scheduled = await harness.transfer("wordpress", destination, article);

    expect(scheduled).toMatchObject({ state: "scheduled", scheduledFor, publishedUrl: null });

    const permalink = `${destination}/background-check-services-guide/`;
    const failed = await harness.verifyWordPressPublication({
      destination,
      websiteId: article.websiteId,
      articleKey: article.articleKey,
      status: 200,
      permalink,
      html: `<html><head><title>${article.title}</title></head><body>${article.contentHtml}</body></html>`,
    });
    expect(failed).toMatchObject({ state: "verification_failed", publishedUrl: null });

    const verified = await harness.verifyWordPressPublication({
      destination,
      websiteId: article.websiteId,
      articleKey: article.articleKey,
      status: 200,
      permalink,
      html: `<html><head><title>${article.title}</title><link rel="canonical" href="${permalink}"><meta property="og:image" content="${destination}/featured.webp"><meta name="robots" content="index,follow"></head><body>${article.contentHtml}</body></html>`,
    });
    expect(verified).toMatchObject({ state: "verified_live", publishedUrl: permalink });
    expect(harness.events().map((event) => event.state)).toEqual([
      "scheduled",
      "verification_failed",
      "verified_live",
    ]);
    expect(harness.events().every((event) => event.jobId && event.recordedAt)).toBe(true);
    expect(network).not.toHaveBeenCalled();
    network.mockRestore();
  });

  it("cannot reconcile another website's receipt", async () => {
    const harness = createOfflineCmsHarness();
    await harness.transfer("wordpress", destination, article);

    await expect(harness.verifyWordPressPublication({
      destination,
      websiteId: "different-website",
      articleKey: article.articleKey,
      status: 200,
      permalink: `${destination}/wrong-site/`,
      html: "<html><body>Wrong site</body></html>",
    })).rejects.toThrow(/receipt/i);
  });
});
