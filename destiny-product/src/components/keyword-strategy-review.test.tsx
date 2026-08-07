import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KeywordStrategyReview } from "./keyword-strategy-review";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const buildKeywords = (length: number) => Array.from({ length }, (_, index) => ({
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

const render = (decisions: Record<string, "approved" | "declined">, keywords = buildKeywords(25)) => renderToStaticMarkup(<KeywordStrategyReview
  auditId="audit-1"
  initialDecisions={decisions}
  keywords={keywords}
  questId="quest-1"
  questStatus="todo"
  websiteId="site-1"
/>);

describe("KeywordStrategyReview bounded approval gate", () => {
  it("unlocks completion after five approved out of 25 without reviewing the rest", () => {
    const html = render(Object.fromEntries(buildKeywords(5).map((keyword) => [keyword.keyword, "approved" as const])));

    expect(html).toContain("5 of 5");
    expect(html).toContain("Build my 12-week content plan");
    expect(html).not.toContain("more to continue");
  });

  it("shows exact remaining approvals when only three are approved", () => {
    const html = render(Object.fromEntries(buildKeywords(3).map((keyword) => [keyword.keyword, "approved" as const])));

    expect(html).toContain("3 of 5");
    expect(html).toContain("Approve 2 more to continue");
    expect(html).toContain("Approve next 2");
    expect(html).toContain('aria-disabled="true"');
  });

  it("keeps unreviewed ideas optional and offers real keyword research for more ideas", () => {
    const html = render({});

    expect(html).toContain("do not need to approve or review all 25");
    expect(html).toContain("Find more keywords");
    expect(html).toContain("/keyword-research?site=site-1&amp;from=strategy");
    expect(html).not.toContain("Decline unreviewed");
  });

  it("opens the content plan once the quest is already complete", () => {
    const html = renderToStaticMarkup(<KeywordStrategyReview
      auditId="audit-1"
      initialDecisions={{}}
      keywords={buildKeywords(25)}
      questId="quest-1"
      questStatus="complete"
      websiteId="site-1"
    />);

    expect(html).toContain("Open my 12-week content plan");
  });
});
