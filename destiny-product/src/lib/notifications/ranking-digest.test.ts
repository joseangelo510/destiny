import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANKING_DIGEST_FREQUENCY,
  RECOMMENDED_RANKING_DIGEST_FREQUENCY,
  baselineLanguage,
  computeNextDigestAt,
  effectiveRankingDigestFrequency,
  isFreshReading,
  isRankingDigestFrequency,
  lastRankingDigestSummary,
  rankingDigestFrequencyLabel,
  rankingDigestPeriodKey,
  rankingEmailCadenceSummary,
  summarizeRankingMovements,
} from "./ranking-digest";

describe("ranking digest frequency contract", () => {
  it("matches the production cadence values and recommends every 3 days", () => {
    expect(isRankingDigestFrequency("three_day")).toBe(true);
    expect(isRankingDigestFrequency("weekly")).toBe(true);
    expect(isRankingDigestFrequency("off")).toBe(true);
    expect(isRankingDigestFrequency("daily")).toBe(false);
    expect(isRankingDigestFrequency(null)).toBe(false);
    expect(RECOMMENDED_RANKING_DIGEST_FREQUENCY).toBe("three_day");
    expect(DEFAULT_RANKING_DIGEST_FREQUENCY).toBe("weekly");
  });

  it("labels the three choices exactly as the product copy requires", () => {
    expect(rankingDigestFrequencyLabel("three_day")).toBe("Every 3 days");
    expect(rankingDigestFrequencyLabel("weekly")).toBe("Weekly");
    expect(rankingDigestFrequencyLabel("off")).toBe("Off");
  });
});

describe("unsubscribe behavior", () => {
  it("treats an unsubscribed website as off regardless of stored cadence", () => {
    expect(effectiveRankingDigestFrequency({ frequency: "three_day", unsubscribedAt: "2026-08-15T00:00:00Z" })).toBe("off");
    expect(effectiveRankingDigestFrequency({ frequency: "weekly", unsubscribedAt: "2026-08-15T00:00:00Z" })).toBe("off");
  });

  it("uses the stored cadence when not unsubscribed and defaults new websites to weekly", () => {
    expect(effectiveRankingDigestFrequency({ frequency: "three_day", unsubscribedAt: null })).toBe("three_day");
    expect(effectiveRankingDigestFrequency(null)).toBe("weekly");
  });
});

describe("rank tracker cadence copy", () => {
  it("describes each cadence in plain language", () => {
    expect(rankingEmailCadenceSummary({ frequency: "three_day", unsubscribedAt: null })).toBe("Ranking email updates arrive every 3 days.");
    expect(rankingEmailCadenceSummary({ frequency: "weekly", unsubscribedAt: null })).toBe("Ranking email updates arrive weekly.");
    expect(rankingEmailCadenceSummary({ frequency: "off", unsubscribedAt: null })).toBe("Ranking email updates are off.");
    expect(rankingEmailCadenceSummary({ frequency: "three_day", unsubscribedAt: "2026-08-15T00:00:00Z" })).toBe("Ranking email updates are off.");
    expect(rankingEmailCadenceSummary(null)).toBe("Ranking email updates arrive weekly.");
  });
});

describe("last-sent state", () => {
  it("reports never, sent, failed, and skipped states with dates", () => {
    expect(lastRankingDigestSummary({ lastStatus: "never", lastSentAt: null })).toBe("No ranking email sent yet");
    expect(lastRankingDigestSummary({ lastStatus: "sent", lastSentAt: "2026-08-14T09:00:00Z" })).toBe("Last sent Aug 14, 2026");
    expect(lastRankingDigestSummary({ lastStatus: "failed", lastSentAt: "2026-08-14T09:00:00Z" })).toBe("Last attempt failed Aug 14, 2026");
    expect(lastRankingDigestSummary({ lastStatus: "skipped", lastSentAt: "2026-08-14T09:00:00Z" })).toBe("Last run skipped Aug 14, 2026");
  });
});

describe("scheduling", () => {
  it("schedules three-day and weekly cadences and never schedules off", () => {
    expect(computeNextDigestAt("three_day", "2026-08-16T09:00:00.000Z")).toBe("2026-08-19T09:00:00.000Z");
    expect(computeNextDigestAt("weekly", "2026-08-16T09:00:00.000Z")).toBe("2026-08-23T09:00:00.000Z");
    expect(computeNextDigestAt("off", "2026-08-16T09:00:00.000Z")).toBeNull();
  });

  it("builds an idempotent period key so one window can never send twice", () => {
    expect(rankingDigestPeriodKey("three_day", "2026-08-16T09:00:00.000Z")).toBe("three_day:2026-08-16");
    expect(rankingDigestPeriodKey("three_day", "2026-08-16T23:59:59.000Z")).toBe("three_day:2026-08-16");
    expect(rankingDigestPeriodKey("weekly", "2026-08-16T09:00:00.000Z")).toBe("weekly:2026-08-16");
  });

  it("only counts readings observed inside the current period as fresh", () => {
    expect(isFreshReading("2026-08-15T12:00:00Z", "2026-08-13T09:00:00Z")).toBe(true);
    expect(isFreshReading("2026-08-12T12:00:00Z", "2026-08-13T09:00:00Z")).toBe(false);
    expect(isFreshReading(null, "2026-08-13T09:00:00Z")).toBe(false);
  });
});

describe("digest movement and baseline logic", () => {
  it("counts up, down, steady, entered and left top 10, and picks top movers", () => {
    const summary = summarizeRankingMovements([
      { keyword: "up big", currentPosition: 4, currentFound: true, previousPosition: 18, previousFound: true },
      { keyword: "down", currentPosition: 15, currentFound: true, previousPosition: 8, previousFound: true },
      { keyword: "steady", currentPosition: 6, currentFound: true, previousPosition: 6, previousFound: true },
      { keyword: "appeared", currentPosition: 40, currentFound: true, previousPosition: null, previousFound: false },
      { keyword: "vanished", currentPosition: null, currentFound: false, previousPosition: 22, previousFound: true },
    ]);
    expect(summary.keywordsCompared).toBe(5);
    expect(summary.movedUp).toBe(2); // "up big" and "appeared"
    expect(summary.movedDown).toBe(2); // "down" and "vanished"
    expect(summary.steady).toBe(1);
    expect(summary.enteredTop10).toBe(1); // "up big" entered
    expect(summary.leftTop10).toBe(1); // "down" left
    expect(summary.topMovers[0].keyword).toBe("vanished"); // largest absolute swing
    expect(summary.topMovers).toHaveLength(3);
  });

  it("treats first readings as baselines, excluded from movement counts", () => {
    const summary = summarizeRankingMovements([
      { keyword: "brand new", currentPosition: 9, currentFound: true, previousPosition: null, previousFound: null },
      { keyword: "existing", currentPosition: 5, currentFound: true, previousPosition: 7, previousFound: true },
    ]);
    expect(summary.baselines).toEqual(["brand new"]);
    expect(summary.keywordsCompared).toBe(1);
    expect(summary.movedUp).toBe(1);
    expect(summary.enteredTop10).toBe(0); // baselines never count as entering
    expect(baselineLanguage("brand new")).toContain("baseline");
    expect(baselineLanguage("brand new")).toContain("first reading");
  });

  it("keeps both-unranked keywords steady without movement", () => {
    const summary = summarizeRankingMovements([
      { keyword: "nowhere", currentPosition: null, currentFound: false, previousPosition: null, previousFound: false },
    ]);
    expect(summary.steady).toBe(1);
    expect(summary.movedUp).toBe(0);
    expect(summary.movedDown).toBe(0);
    expect(summary.topMovers).toHaveLength(0);
  });
});
