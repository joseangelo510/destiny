import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RankTrackerWorkspace } from "./rank-tracker-workspace";
import { rankTrackerView } from "../lib/seo/rank-tracker";

describe("RankTrackerWorkspace", () => {
  it("shows cadence, measurement context, lists, and truthful states", async () => {
    const now = new Date("2026-08-03T00:00:00.000Z");
    const rankedPolicy = await rankTrackerView({ status: "active", position: 7, found: true }, { position: 13, found: true }, { createdAt: "2026-07-20T00:00:00.000Z", lastCheckedAt: "2026-08-02T00:00:00.000Z", now });
    const pendingPolicy = await rankTrackerView({ status: "pending", position: null, found: null }, null, { createdAt: "2026-08-03T00:00:00.000Z", lastCheckedAt: null, now });
    const html = renderToStaticMarkup(<RankTrackerWorkspace
      initialLists={[{ id: "list-1", name: "Admissions services" }]}
      initialKeywords={[
        { id: "kw-1", keyword: "college admissions consultant", listId: null, status: "active", source: "strategy", createdAt: "2026-07-20T00:00:00.000Z", lastCheckedAt: "2026-08-27T02:30:00.000Z", currentPosition: 7, previousPosition: 13, previousFound: true, found: true, resultUrl: "https://example.com/services", checkedAt: "2026-08-27T02:30:00.000Z", policyView: rankedPolicy },
        { id: "kw-2", keyword: "college essay help", listId: "list-1", status: "pending", source: "research", createdAt: "2026-08-03T00:00:00.000Z", lastCheckedAt: null, currentPosition: null, previousPosition: null, found: null, resultUrl: null, checkedAt: null, policyView: pendingPolicy },
      ]}
      trackingAvailable={true}
      canManageBilling={true}
      rankingDigestFrequency="three_day"
      reportGeneratedAt="2026-08-27T02:30:00.000Z"
      websiteId="website-1"
    />);
    expect(html).toContain("Ranking emails every 3 days");
    expect(html).toContain("United States · English · Desktop");
    expect(html).toContain("General");
    expect(html).toContain("Admissions services");
    expect(html).toContain("Up 6");
    expect(html).toContain("First check pending");
    expect(html).toContain("usually arrives within minutes");
    expect(html).toContain("Add keywords");
    expect(html).toContain("Pause college admissions consultant");
    expect(html).toContain("Evidence checked Aug 27, 2026, 2:30 AM UTC");
    expect(html).toContain("Aug 27, 2026");
  });
});

it.each([true, false])("retains saved rankings and explains stopped checks for billing owner=%s", canManageBilling => {
  const html = renderToStaticMarkup(<RankTrackerWorkspace websiteId="site-a" initialLists={[]} trackingAvailable={false} canManageBilling={canManageBilling} initialKeywords={[
    { id: "saved", keyword: "saved keyword", listId: null, status: "active", source: "manual", createdAt: "2026-08-01T00:00:00Z", lastCheckedAt: "2026-08-02T00:00:00Z", currentPosition: 7, previousPosition: null, found: true, resultUrl: "https://example.com/saved", checkedAt: "2026-08-02T00:00:00Z", policyView: { reading: { label: "#7", tone: "ranked" }, movement: { label: "—", tone: "flat" }, freshness: { message: "Saved evidence" }, bucket: 10 } }
  ]} />);
  expect(html).toContain("New rank checks are unavailable for this website");
  expect(html).toContain("saved keyword");
  expect(html).toContain("#7");
  expect(html).toContain("https://example.com/saved");
  expect(html).toContain("New checks stopped");
  expect(html).not.toContain("1 enabled");
  expect(html).not.toContain("usually arrives within minutes");
  expect(html).toContain(canManageBilling ? "Review plan and managed websites" : "Ask the website owner");
});
