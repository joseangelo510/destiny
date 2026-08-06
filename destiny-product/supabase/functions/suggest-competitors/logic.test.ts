import { describe, expect, it } from "vitest";
import { parseCompetitorSuggestions } from "./logic";

describe("competitor suggestions", () => {
  it("returns distinct organic search neighbors without the target or social platforms", () => {
    const payload = { status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [
      { domain: "empowerly.com", intersections: 900 },
      { domain: "IvyWise.com", intersections: 120 },
      { domain: "collegevine.com", intersections: 90 },
      { domain: "www.youtube.com", intersections: 80 },
      { domain: "ivywise.com", intersections: 60 },
    ] }] }] };

    expect(parseCompetitorSuggestions(payload, "https://empowerly.com")).toEqual([
      { domain: "ivywise.com", sharedKeywords: 120, relation: "search_landscape" },
      { domain: "collegevine.com", sharedKeywords: 90, relation: "search_landscape" },
    ]);
  });
});
