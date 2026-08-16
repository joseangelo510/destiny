import { describe, expect, it } from "vitest";
import { assertScorecardSnapshot, buildScorecardSnapshot, type ScorecardSource } from "./scorecard";

const source: ScorecardSource = {
  accountId: "account-1",
  websiteId: "website-1",
  messageId: "scorecard:website-1:2026-08-10",
  weekNumber: 33,
  streakLength: 3,
  weekState: "completed",
  freezesRemaining: 2,
  metrics: [
    { key: "ranking-keywords", label: "Ranking keywords", value: "25", delta: "+4", direction: "up", sparkline: [18, 20, 21, 25] },
    { key: "critical-issues", label: "Critical issues", value: "2", delta: "-1", direction: "down", sparkline: [5, 4, 3, 2] },
  ],
  wins: [{ objectName: "Keyword strategy", objectUrl: "/keywords?site=website-1", from: "Open", to: "Approved", metric: "5 searches" }],
  attention: [{ problem: "Two critical issues remain", cause: "The latest audit found blocked pages", fix: "Review the technical task", timeCostMinutes: 15, deepLink: "/this-week?site=website-1" }],
  cta: { label: "Continue this Week", deepLink: "/this-week?site=website-1", timeCostMinutes: 15 },
  nextWeek: { weekNumber: 34, actionsRequired: 1, timeCostMinutes: 15 },
};

describe("Destiny scorecard snapshots", () => {
  it("builds a full snapshot from evidence and exact deep links", () => {
    const snapshot = assertScorecardSnapshot(buildScorecardSnapshot(source));
    expect(snapshot).toMatchObject({ variant: "full", headline: "1 useful step moved forward this Week." });
  });

  it("uses first and thin variants without inventing metrics", () => {
    const first = buildScorecardSnapshot({ ...source, metrics: [], wins: [], isFirstScorecard: true });
    const thin = buildScorecardSnapshot({ ...source, metrics: source.metrics.slice(0, 1), wins: [], hasComparisonEvidence: false, weekState: "open" });
    expect(first).toMatchObject({ variant: "first", metrics: [], wins: [] });
    expect(thin).toMatchObject({ variant: "thin", metrics: [source.metrics[0]], wins: [] });
  });

  it("caps collections to the frozen contract", () => {
    const snapshot = buildScorecardSnapshot({ ...source, metrics: [...source.metrics, ...source.metrics, ...source.metrics], wins: [...source.wins!, ...source.wins!, ...source.wins!, ...source.wins!] });
    expect(snapshot.metrics).toHaveLength(4);
    expect(snapshot.wins).toHaveLength(3);
  });

  it("rejects external or missing-time CTAs", () => {
    expect(() => assertScorecardSnapshot(buildScorecardSnapshot({ ...source, cta: { label: "Bad", deepLink: "https://example.com", timeCostMinutes: 0 } }))).toThrow();
  });
});
