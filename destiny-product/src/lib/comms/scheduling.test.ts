import { describe, expect, it } from "vitest";
import { continuityMessagesDue, isLocalMorningSendWindow } from "./scheduling";
import { createWeekContinuity } from "./week";

describe("Destiny comms scheduling", () => {
  const continuity = createWeekContinuity(new Date("2026-08-10T12:00:00Z"), "America/Los_Angeles");

  it("queues Friday and Sunday at most once each", () => {
    expect(continuityMessagesDue({ continuity, now: new Date("2026-08-14T20:00:00Z"), alreadyEmitted: [], cadence: "weekly" })).toEqual(["week.at_risk"]);
    expect(continuityMessagesDue({ continuity, now: new Date("2026-08-17T00:30:00Z"), alreadyEmitted: ["week.at_risk"], cadence: "weekly" })).toEqual(["week.last_chance"]);
    expect(continuityMessagesDue({ continuity, now: new Date("2026-08-17T00:30:00Z"), alreadyEmitted: ["week.at_risk", "week.last_chance"], cadence: "weekly" })).toEqual([]);
  });

  it("suppresses continuity messages after completion or when muted", () => {
    expect(continuityMessagesDue({ continuity: { ...continuity, state: "completed" }, now: new Date("2026-08-17T00:30:00Z"), alreadyEmitted: [], cadence: "weekly" })).toEqual([]);
    expect(continuityMessagesDue({ continuity, now: new Date("2026-08-17T00:30:00Z"), alreadyEmitted: [], cadence: "muted" })).toEqual([]);
  });

  it("recognizes the 7:15 to 8:15 local delivery window", () => {
    expect(isLocalMorningSendWindow(new Date("2026-08-10T14:15:00Z"), "America/Los_Angeles")).toBe(true);
    expect(isLocalMorningSendWindow(new Date("2026-08-10T15:16:00Z"), "America/Los_Angeles")).toBe(false);
  });
});
