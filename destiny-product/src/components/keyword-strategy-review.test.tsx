import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KeywordStrategyReview } from "./keyword-strategy-review";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const keywords = Array.from({ length: 20 }, (_, index) => ({
  keyword: `revenue keyword ${index + 1}`,
  searchVolume: 100 + index,
  difficulty: 25,
  competitorRankers: 2,
  rank: 0,
  cpc: 4,
  opportunity: "competitor_gap",
  providerIntent: "commercial" as const,
  searchIntent: "consideration" as const,
  priorityScore: 80 - index,
  priorityReason: "Comparison intent with meaningful demand",
  themeId: `theme-${index % 4}`,
  themeLabel: `Theme ${(index % 4) + 1}`,
  themeRole: "revenue",
  essential: index < 3,
}));

describe("KeywordStrategyReview planning horizon", () => {
  it("offers broad keyword choice but bulk-approves only the three-month starting set", () => {
    const html = renderToStaticMarkup(<KeywordStrategyReview
      auditId="audit-1"
      initialDecisions={{}}
      keywords={keywords}
      questId="quest-1"
      questStatus="todo"
    />);

    expect(html).toContain("three-month opportunity pool");
    expect(html).toContain("Approve top 15");
    expect(html).toContain("12-week editorial calendar");
    expect(html).not.toMatch(/six-month|top 30/i);
  });
});
