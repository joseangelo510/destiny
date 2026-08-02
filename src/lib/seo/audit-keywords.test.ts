import { describe, expect, it } from "vitest";
import { selectUsableAuditKeywords } from "./audit-keywords";

describe("saved audit keyword presentation", () => {
  it("keeps LOGOS accept and review decisions while hiding rejected phrases", () => {
    const keywords = selectUsableAuditKeywords([
      { keyword: "college admissions counseling", verdict: "accept" },
      { keyword: "application coaching", verdict: "review" },
      { keyword: "books about marketing and sales", verdict: "reject" },
      { keyword: 17, verdict: "accept" },
    ]);

    expect(keywords.map((item) => item.keyword)).toEqual([
      "college admissions counseling",
      "application coaching",
    ]);
  });
});
