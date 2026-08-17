import { describe, expect, it } from "vitest";
import { buildRankDigest, nextDigestAt, shouldSendDigest } from "./logic";

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
    expect(digest.subject).toBe("Jose Angelo Studios: 2 up, 2 down");
    expect(digest.rows.find((row) => row.keyword === "youtube ad agency")).toMatchObject({ change: 6, direction: "up" });
    expect(digest.averageCurrent).toBe(13);
    expect(digest.top10Current).toBe(2);
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

  it("requires fresh observations after the previous digest", () => {
    expect(shouldSendDigest(null, "2026-08-16T15:00:00.000Z")).toBe(true);
    expect(shouldSendDigest("2026-08-16T16:00:00.000Z", "2026-08-16T15:00:00.000Z")).toBe(false);
    expect(shouldSendDigest("2026-08-16T14:00:00.000Z", "2026-08-16T15:00:00.000Z")).toBe(true);
  });
});
