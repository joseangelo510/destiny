import { describe, expect, it } from "vitest";
import { parseCompetitorEntries, validateCompetitorEntries } from "./competitors";

describe("competitor onboarding", () => {
  it("requires at least two distinct competitors", () => {
    expect(validateCompetitorEntries("Only One")).toEqual({
      ready: false,
      count: 1,
      error: "Add at least two competitors so Destiny can find meaningful gaps.",
    });
    expect(validateCompetitorEntries("IvyWise\nCollegewise").ready).toBe(true);
  });

  it("normalizes names and public website domains without merging distinct entries", () => {
    expect(parseCompetitorEntries("IvyWise — ivywise.com\nhttps://collegewise.com/\nIvyWise — ivywise.com")).toEqual([
      { name: "IvyWise", url: "https://ivywise.com/", domain: "ivywise.com" },
      { name: "collegewise.com", url: "https://collegewise.com/", domain: "collegewise.com" },
    ]);
  });
});
