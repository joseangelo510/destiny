import { describe, expect, it } from "vitest";
import { selectQuickKeywordApprovals } from "./quick-keyword-approval";

const recommended = (keyword: string, searchVolume = 100) => ({
  keyword,
  searchVolume,
  priorityScore: 90,
  priorityReason: "High-intent opportunity with measured demand",
  themeId: "services",
  themeLabel: "Services",
});

describe("selectQuickKeywordApprovals", () => {
  it("approves enough ranked recommendations to reach the initial target", () => {
    const result = selectQuickKeywordApprovals({
      providerResult: {
        keywords: [
          recommended("commercial junk removal"),
          recommended("office junk removal"),
          recommended("construction debris removal"),
          recommended("same day junk removal"),
          recommended("appliance removal service"),
          recommended("furniture removal service"),
        ],
      },
    }, [{ keyword: "commercial junk removal", decision: "approved" }], 5);

    expect(result.ready).toBe(true);
    expect(result.approvals).toEqual([
      "office junk removal",
      "construction debris removal",
      "same day junk removal",
      "appliance removal service",
    ]);
  });

  it("never overrides declined keywords and rejects zero-volume or unscored suggestions", () => {
    const result = selectQuickKeywordApprovals({
      providerResult: {
        keywords: [
          recommended("declined keyword"),
          recommended("zero demand", 0),
          { ...recommended("missing evidence"), priorityReason: "" },
          recommended("qualified one"),
          recommended("qualified two"),
          recommended("qualified three"),
          recommended("qualified four"),
          recommended("qualified five"),
        ],
      },
    }, [{ keyword: "declined keyword", decision: "declined" }], 5);

    expect(result.ready).toBe(true);
    expect(result.approvals).toEqual([
      "qualified one",
      "qualified two",
      "qualified three",
      "qualified four",
      "qualified five",
    ]);
  });

  it("fails closed when the saved audit does not contain enough evidence-backed recommendations", () => {
    const result = selectQuickKeywordApprovals({
      providerResult: { keywords: [recommended("qualified one"), recommended("zero demand", 0)] },
    }, [], 5);

    expect(result.ready).toBe(false);
    expect(result.approvals).toEqual([]);
    expect(result.missing).toBe(4);
  });
});
