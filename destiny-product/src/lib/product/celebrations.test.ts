import { describe, expect, it } from "vitest";
import { CELEBRATION_KINDS, celebrationMessage, celebrationSoundPattern, parseCelebrationPreferences } from "./celebrations";

describe("Rebound SEO celebration preferences and original sounds", () => {
  it("defaults to sound off with full but respectful celebrations", () => {
    expect(parseCelebrationPreferences(null)).toEqual({ muted: true, reduced: false });
    expect(parseCelebrationPreferences("not-json")).toEqual({ muted: true, reduced: false });
    expect(parseCelebrationPreferences('{"muted":true,"reduced":true}')).toEqual({ muted: true, reduced: true });
  });

  it("uses earned coach language without points or fabricated outcomes", () => {
    expect(celebrationMessage("task_complete")).toEqual({
      title: "Shipped.",
      detail: "Your roadmap moved forward.",
    });
    expect(celebrationMessage("verified_result").title).toBe("Verified result.");
    expect(CELEBRATION_KINDS.map(celebrationMessage).join(" ")).not.toContain("XP");
  });

  it("defines a distinct original pattern for all four celebration moments", () => {
    expect(CELEBRATION_KINDS).toEqual(["task_complete", "perfect_week", "verified_result", "roadmap_unlock"]);
    const signatures = CELEBRATION_KINDS.map((kind) => JSON.stringify(celebrationSoundPattern(kind, false)));
    expect(new Set(signatures).size).toBe(4);
    expect(CELEBRATION_KINDS.every((kind) => celebrationSoundPattern(kind, true).length <= celebrationSoundPattern(kind, false).length)).toBe(true);
  });
});
