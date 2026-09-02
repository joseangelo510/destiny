import { describe, expect, it } from "vitest";
import { buildHomeCalendarSummary } from "./home-calendar-summary";

describe("Rebound Home calendar summary", () => {
  it("anchors the Home month to today instead of the oldest saved event", () => {
    const summary = buildHomeCalendarSummary({
      events: [{ id: "old", date: "2026-08-15T16:00:00Z", title: "Old saved item", state: "scheduled", tone: "move" }],
      now: new Date("2026-09-01T19:00:00Z"),
      timeZone: "America/Los_Angeles",
    });

    expect(summary).toMatchObject({ month: "September 2026", anchorDate: "2026-09-01" });
    expect(summary.events).toHaveLength(1);
  });
});
