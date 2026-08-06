import { describe, expect, it } from "vitest";
import { buildSeasonSnapshot, buildWitnessLog, selectDiscoveryMoment } from "./founder-journey";

describe("founder journey truth layer", () => {
  it("uses the strongest connected first-party signal without inventing timing or identity", () => {
    expect(selectDiscoveryMoment({ organicKeyEvents: 0, searchClicks: 7, searchImpressions: 240 })).toEqual({
      detail: "Google Search sent 7 visits to your website in the latest connected period.",
      label: "search visits",
      source: "Google Search Console",
      title: "Someone found you.",
      value: "7",
    });
  });

  it("returns no discovery celebration when connected evidence is empty", () => {
    expect(selectDiscoveryMoment({ organicKeyEvents: 0, searchClicks: 0, searchImpressions: 0 })).toBeNull();
  });

  it("keeps self-reported work separate from verified evidence in the witness log", () => {
    const entries = buildWitnessLog({
      auditComplete: true,
      analytics: { organicKeyEvents: 2 },
      quests: [
        { id: "q1", title: "Publish your first guide", status: "complete", verification_status: "unverified", completed_at: "2026-08-03T12:00:00Z" },
        { id: "q2", title: "Fix the homepage title", status: "complete", verification_status: "verified", completed_at: "2026-08-04T12:00:00Z" },
      ],
      searchConsole: { clicks: 9, impressions: 600 },
    });

    expect(entries.map((entry) => entry.title)).toEqual([
      "Your search work created action",
      "Fix the homepage title",
      "Publish your first guide",
      "Your audit became a plan",
    ]);
    expect(entries[1]).toMatchObject({ proof: "Verified by Destiny", tone: "verified" });
    expect(entries[2]).toMatchObject({ proof: "Marked done by you", tone: "reported" });
  });

  it("summarizes the 90-day season only from saved work and evidence", () => {
    expect(buildSeasonSnapshot({
      activeWeeks: 3,
      quests: [
        { status: "complete", verification_status: "verified" },
        { status: "complete", verification_status: "unverified" },
        { status: "todo", verification_status: "unverified" },
      ],
      verifiedSignals: 2,
    })).toEqual({
      activeWeeks: 3,
      completedTasks: 2,
      currentWeek: 4,
      totalWeeks: 13,
      verifiedResults: 3,
    });
  });
});
