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
        { id: "kw-1", keyword: "college admissions consultant", listId: null, status: "active", source: "strategy", createdAt: "2026-07-20T00:00:00.000Z", lastCheckedAt: "2026-08-02T00:00:00.000Z", currentPosition: 7, previousPosition: 13, previousFound: true, found: true, resultUrl: "https://example.com/services", checkedAt: "2026-08-02T00:00:00.000Z", policyView: rankedPolicy },
        { id: "kw-2", keyword: "college essay help", listId: "list-1", status: "pending", source: "research", createdAt: "2026-08-03T00:00:00.000Z", lastCheckedAt: null, currentPosition: null, previousPosition: null, found: null, resultUrl: null, checkedAt: null, policyView: pendingPolicy },
      ]}
      websiteId="website-1"
    />);
    expect(html).toContain("Weekly Google rank tracking");
    expect(html).toContain("United States · English · Desktop");
    expect(html).toContain("General");
    expect(html).toContain("Admissions services");
    expect(html).toContain("Up 6");
    expect(html).toContain("First check pending");
    expect(html).toContain("usually arrives within minutes");
    expect(html).toContain("Add keywords");
  });
});
