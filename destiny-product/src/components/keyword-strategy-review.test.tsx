import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KeywordStrategyReview } from "./keyword-strategy-review";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const keywords = Array.from({ length: 25 }, (_, index) => ({
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
  it("makes five approvals sufficient without forcing a review of all 25", () => {
    const html = renderToStaticMarkup(<KeywordStrategyReview
      auditId="audit-1"
      initialDecisions={Object.fromEntries(keywords.slice(0, 5).map((keyword) => [keyword.keyword, "approved" as const]))}
      keywords={keywords}
      moreKeywordsHref="/keyword-research?from=strategy"
      nextHref="/content?strategy=complete"
      questId="quest-1"
      questStatus="todo"
    />);

    expect(html).toContain("5 of 5");
    expect(html).toContain("approved");
    expect(html).toContain("You do not need to approve or review all 25");
    expect(html).toContain("Build my 12-week content plan");
    expect(html).toContain("Find more keywords");
    expect(html).toContain("12-week editorial calendar");
    expect(html).not.toContain("Decline unreviewed");
  });

  it("explains the exact approval gap instead of showing a silent disabled finish button", () => {
    const html = renderToStaticMarkup(<KeywordStrategyReview
      auditId="audit-1"
      initialDecisions={Object.fromEntries(keywords.slice(0, 3).map((keyword) => [keyword.keyword, "approved" as const]))}
      keywords={keywords}
      moreKeywordsHref="/keyword-research?from=strategy"
      nextHref="/content?strategy=complete"
      questId="quest-1"
      questStatus="todo"
    />);

    expect(html).toContain("3 of 5");
    expect(html).toContain("Approve 2 more to continue");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/Approve 2 more to continue<\/button[^>]* disabled/);
  });
});
