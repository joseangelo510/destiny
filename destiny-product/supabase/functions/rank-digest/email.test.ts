import { describe, expect, it } from "vitest";
import { renderRankDigestEmail } from "./email";
import { buildRankDigest, type RankDigestOpportunity } from "./logic";

const opportunities: RankDigestOpportunity[] = [
  { keyword: "youtube channel audit service", estimatedVolume: 480, intent: "commercial", difficulty: 28, priorityScore: 92, reason: "Your audit page already covers this topic.", evidenceSource: "site_audit" },
  { keyword: "hire youtube ads manager", estimatedVolume: 260, intent: "transactional", difficulty: 35, priorityScore: 88, reason: "Searchers using this phrase are ready to hire.", evidenceSource: "competitor_gap" },
];

function render(readings: Parameters<typeof buildRankDigest>[1]) {
  const digest = buildRankDigest("Jose Angelo Studios", readings);
  return renderRankDigestEmail({
    siteName: digest.siteName,
    domain: "joseangelostudios.com",
    digest,
    opportunities,
    rankUrl: "https://destiny.test/rank-tracker?site=1",
    keywordStrategyUrl: "https://destiny.test/keywords?site=1",
    accountUrl: "https://destiny.test/account?site=1",
    unsubscribeUrl: "https://destiny.test/unsubscribe",
    firstNotice: false,
    isTest: false,
    measurement: { locationName: "United States", device: "Desktop", rangeStart: "2026-08-09T00:00:00Z", rangeEnd: "2026-08-16T00:00:00Z" },
  });
}

describe("rank digest email", () => {
  it("separates measured tracked rankings from untracked suggestions", () => {
    const email = render([
      { keyword: "youtube seo agency", currentFound: true, currentPosition: 1, previousFound: true, previousPosition: 5, searchVolume: 210 },
      { keyword: "youtube ads consultant", currentFound: false, currentPosition: null, previousFound: true, previousPosition: 8, searchVolume: 20 },
    ]);
    expect(email.subject).toBe("Jose Angelo Studios: a keyword reached #1");
    expect(email.html).toContain("Your tracked keywords");
    expect(email.html).toContain("Keywords you chose · measured from Google results");
    expect(email.html).toContain("Opportunities Destiny found");
    expect(email.html).toContain("Suggestions · not tracked yet");
    expect(email.html).toContain("Not yet visible");
    expect(email.html).not.toContain("Not in top 100");
    expect(email.html).not.toContain("Not found in top 100");
    expect(email.text).toContain("SUGGESTIONS, NOT TRACKED");
  });

  it("renders a useful starting point instead of an empty ranking table", () => {
    const email = render([]);
    expect(email.subject).toBe("Jose Angelo Studios: your search visibility starting point");
    expect(email.html).toContain("Your visibility starting point is ready.");
    expect(email.html).toContain("2 opportunities Destiny found");
    expect(email.html).toContain("Choose keywords to track");
    expect(email.html).not.toContain("<table>");
    expect(email.text).toContain("These are suggestions, not current rankings.");
  });

  it("labels modeled metrics and hides unsupported numbers", () => {
    const email = render([
      { keyword: "no volume keyword", currentFound: true, currentPosition: 8, previousFound: null, previousPosition: null },
    ]);
    expect(email.html).toContain("Modeled estimate · not measured traffic");
    expect(email.html).toContain("Available when tracked keywords have search-volume data.");
    expect(email.html).not.toContain("undefined");
    expect(email.html).not.toContain("NaN");
  });
});
