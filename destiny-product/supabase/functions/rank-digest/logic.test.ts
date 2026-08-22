import { describe, expect, it } from "vitest";
import { buildRankDigest, deliveryStateFromProviderEvent, nextDigestAt, reconcileDeliveryReceipt, selectDigestOpportunities, shouldSendDigest } from "./logic";

describe("rank digest logic", () => {
  it("summarizes upward, downward, top-ten, new, and lost movement truthfully", () => {
    const digest = buildRankDigest("Jose Angelo Studios", [
      { keyword: "youtube ad agency", currentFound: true, currentPosition: 8, previousFound: true, previousPosition: 14 },
      { keyword: "youtube seo agency", currentFound: true, currentPosition: 12, previousFound: true, previousPosition: 5 },
      { keyword: "video seo experts", currentFound: true, currentPosition: 27, previousFound: false, previousPosition: null },
      { keyword: "youtube marketing agency", currentFound: false, currentPosition: null, previousFound: true, previousPosition: 18 },
      { keyword: "youtube channel management", currentFound: true, currentPosition: 4, previousFound: true, previousPosition: 4 },
    ]);

    expect(digest.counts).toEqual({ up: 2, down: 2, steady: 1, enteredTop10: 1, leftTop10: 1 });
    expect(digest.subject).toBe("Jose Angelo Studios: 1 keyword reached page 1");
    expect(digest.rows.find((row) => row.keyword === "youtube ad agency")).toMatchObject({ change: 6, direction: "up" });
    expect(digest.averageCurrent).toBe(13);
    expect(digest.top10Current).toBe(2);
    expect(digest.distribution).toEqual({ top3: 0, top10: 2, top20: 3, top100: 4, notYetVisible: 1 });
  });

  it("uses a calm subject when no keyword moved", () => {
    const digest = buildRankDigest("ClearCheck", [
      { keyword: "background check app", currentFound: true, currentPosition: 6, previousFound: true, previousPosition: 6 },
    ]);
    expect(digest.subject).toBe("ClearCheck: rankings holding steady");
    expect(digest.counts.steady).toBe(1);
  });

  it("does not invent movement when only a baseline reading exists", () => {
    const digest = buildRankDigest("New site", [
      { keyword: "new keyword", currentFound: true, currentPosition: 21, previousFound: null, previousPosition: null },
    ]);
    expect(digest.subject).toBe("New site: your first ranking baseline");
    expect(digest.hasComparison).toBe(false);
    expect(digest.counts).toEqual({ up: 0, down: 0, steady: 0, enteredTop10: 0, leftTop10: 0 });
  });

  it("computes three-day and weekly delivery windows", () => {
    const sent = new Date("2026-08-16T16:00:00.000Z");
    expect(nextDigestAt(sent, "three_day").toISOString()).toBe("2026-08-19T16:00:00.000Z");
    expect(nextDigestAt(sent, "weekly").toISOString()).toBe("2026-08-23T16:00:00.000Z");
  });

  it("distinguishes provider acceptance from confirmed inbox delivery", () => {
    expect(deliveryStateFromProviderEvent("sent")).toBe("accepted");
    expect(deliveryStateFromProviderEvent("delivery_delayed")).toBe("accepted");
    expect(deliveryStateFromProviderEvent("delivered")).toBe("delivered");
    expect(deliveryStateFromProviderEvent("opened")).toBe("delivered");
    expect(deliveryStateFromProviderEvent("bounced")).toBe("failed");
    expect(deliveryStateFromProviderEvent("suppressed")).toBe("failed");
  });

  it("reconciles accepted, delivered, and failed provider receipts without inventing delivery", () => {
    const checkedAt = "2026-08-22T06:45:00.000Z";

    expect(reconcileDeliveryReceipt("accepted", "sent", checkedAt)).toEqual({
      status: "accepted",
      providerEvent: "sent",
      checkedAt,
      deliveredAt: null,
      error: null,
    });
    expect(reconcileDeliveryReceipt("accepted", "delivered", checkedAt)).toEqual({
      status: "delivered",
      providerEvent: "delivered",
      checkedAt,
      deliveredAt: checkedAt,
      error: null,
    });
    expect(reconcileDeliveryReceipt("accepted", "bounced", checkedAt)).toEqual({
      status: "failed",
      providerEvent: "bounced",
      checkedAt,
      deliveredAt: null,
      error: "Email provider reported bounced.",
    });
  });

  it("does not downgrade a terminal receipt when the provider repeats an older accepted event", () => {
    const checkedAt = "2026-08-22T06:46:00.000Z";
    expect(reconcileDeliveryReceipt("delivered", "sent", checkedAt).status).toBe("delivered");
    expect(reconcileDeliveryReceipt("failed", "sent", checkedAt).status).toBe("failed");
  });

  it("requires fresh observations after the previous digest", () => {
    expect(shouldSendDigest(null, "2026-08-16T15:00:00.000Z")).toBe(true);
    expect(shouldSendDigest("2026-08-16T16:00:00.000Z", "2026-08-16T15:00:00.000Z")).toBe(false);
    expect(shouldSendDigest("2026-08-16T14:00:00.000Z", "2026-08-16T15:00:00.000Z")).toBe(true);
  });

  it("calculates estimated visibility only when real search-volume evidence exists", () => {
    const digest = buildRankDigest("Jose Angelo Studios", [
      { keyword: "youtube seo agency", currentFound: true, currentPosition: 1, previousFound: true, previousPosition: 5, searchVolume: 210 },
      { keyword: "youtube marketing services", currentFound: true, currentPosition: 4, previousFound: true, previousPosition: 6, searchVolume: 320 },
    ]);
    expect(digest.estimatedMonthlyVisits).toBe(81.2);
    expect(digest.visibilityPercent).toBe(15.32);
    expect(digest.topTracked[0]).toMatchObject({ keyword: "youtube seo agency", milestone: "hit_1" });

    const unavailable = buildRankDigest("No volume", [
      { keyword: "private phrase", currentFound: true, currentPosition: 3, previousFound: null, previousPosition: null },
    ]);
    expect(unavailable.estimatedMonthlyVisits).toBeNull();
    expect(unavailable.visibilityPercent).toBeNull();
  });

  it("keeps only positive-demand, untracked opportunities and prioritizes revenue intent", () => {
    const candidates = [
      { keyword: "broad guide", estimatedVolume: 9000, intent: "informational" as const, difficulty: 20, priorityScore: 45, reason: "Broad awareness.", evidenceSource: "site_audit" as const },
      { keyword: "hire youtube agency", estimatedVolume: 260, intent: "transactional" as const, difficulty: 31, priorityScore: 88, reason: "Ready to hire.", evidenceSource: "competitor_gap" as const },
      { keyword: "zero demand", estimatedVolume: 0, intent: "commercial" as const, difficulty: 5, priorityScore: 99, reason: "No demand.", evidenceSource: "site_audit" as const },
      { keyword: "already tracked", estimatedVolume: 500, intent: "commercial" as const, difficulty: 22, priorityScore: 92, reason: "Excluded.", evidenceSource: "serp_scan" as const },
    ];
    expect(selectDigestOpportunities(candidates, ["Already   Tracked"]).map((row) => row.keyword)).toEqual(["hire youtube agency", "broad guide"]);
  });
});
