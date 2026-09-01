import { describe, expect, it } from "vitest";
import { buildDistributionOpportunityAction, distributionOpportunityFreshness } from "./distribution-actions";

describe("Rebound distribution opportunity actions", () => {
  it.each([
    ["Quora", "https://quora.com/question"],
    ["Quora", "https://www.quora.com/question"],
    ["Reddit", "https://reddit.com/r/seo/comments/abc/question"],
    ["Reddit", "https://www.reddit.com/r/seo/comments/abc/question"],
  ] as const)("allows the exact saved %s destination %s", (platform, url) => {
    expect(buildDistributionOpportunityAction({
      platform,
      title: "Saved title",
      context: "Saved context",
      url,
      checkedAt: "2026-09-01T00:00:00.000Z",
    })).toEqual({
      platform,
      url,
      hostname: new URL(url).hostname,
      checkedAt: "2026-09-01T00:00:00.000Z",
      copyText: `Saved title\nSaved context\n${url}\nChecked 2026-09-01T00:00:00.000Z`,
    });
  });

  it.each([
    "http://www.quora.com/question",
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://quora.com@evil.com/question",
    "https://quora.com.evil.com/question",
    "https://old.reddit.com/r/seo/comments/abc/question",
    "https://user@reddit.com/r/seo/comments/abc/question",
  ])("rejects an unsafe or unapproved destination: %s", (url) => {
    expect(buildDistributionOpportunityAction({ platform: "Quora", title: "Saved title", context: "Saved context", url, checkedAt: null })).toBeNull();
  });

  it("rejects a platform and destination mismatch", () => {
    expect(buildDistributionOpportunityAction({ platform: "Quora", title: "Saved title", context: "Saved context", url: "https://www.reddit.com/r/seo/comments/abc/question", checkedAt: null })).toBeNull();
  });

  it("keeps freshness read-only and treats old or missing evidence as stale", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    expect(distributionOpportunityFreshness("2026-08-31T12:00:00.000Z", now)).toMatchObject({ stale: false, label: "Checked Aug 31" });
    expect(distributionOpportunityFreshness("2026-08-01T12:00:00.000Z", now)).toMatchObject({ stale: true, label: "Stale — reverify before engaging" });
    expect(distributionOpportunityFreshness(null, now)).toEqual({ stale: true, label: "Freshness unavailable — reverify before engaging" });
  });
});
