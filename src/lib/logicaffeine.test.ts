import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { runDestinyLogic as runBrowserLogic } from "./logicaffeine";
import { runDestinyLogic as runWorkerLogic } from "../../supabase/functions/process-audit/logic";

const wasmPath = new URL("../../public/logic/destiny-logic-engine.wasm", import.meta.url);

async function runBoth(input: Parameters<typeof runBrowserLogic>[0]) {
  const bytes = await readFile(wasmPath);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes)));
  const [browser, worker] = await Promise.all([runBrowserLogic(input), runWorkerLogic(input)]);
  vi.unstubAllGlobals();
  return { browser, worker };
}

describe("Destiny LOGOS parity", () => {
  it.each([
    [{ auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0 }, { growthStage: "audit_in_progress", decisionCode: "audit_waiting", questCategory: "measurement", urgency: "waiting" }],
    [{ auditComplete: 1, criticalIssues: 3, warnings: 7, rankingKeywords: 40, newKeywords: 4, lostKeywords: 0, contentGaps: 0, reviewCount: 30 }, { growthStage: "fix_foundations", decisionCode: "fix_technical", questCategory: "technical", urgency: "urgent" }],
    [{ auditComplete: 1, criticalIssues: 0, warnings: 2, rankingKeywords: 40, newKeywords: 1, lostKeywords: 5, contentGaps: 0, reviewCount: 30 }, { growthStage: "build_search_coverage", decisionCode: "refresh_declining", questCategory: "content", urgency: "high" }],
    [{ auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 7, newKeywords: 2, lostKeywords: 0, contentGaps: 8, reviewCount: 20 }, { growthStage: "build_search_coverage", decisionCode: "publish_gap", questCategory: "content", urgency: "focused" }],
    [{ auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 22, newKeywords: 2, lostKeywords: 0, contentGaps: 0, reviewCount: 6 }, { growthStage: "compound_distribution", decisionCode: "request_reviews", questCategory: "reviews", urgency: "focused" }],
    [{ auditComplete: 1, criticalIssues: 0, warnings: 4, rankingKeywords: 22, newKeywords: 2, lostKeywords: 0, contentGaps: 0, reviewCount: 20 }, { growthStage: "compound_distribution", decisionCode: "fix_warning", questCategory: "technical", urgency: "routine" }],
    [{ auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 22, newKeywords: 2, lostKeywords: 0, contentGaps: 0, reviewCount: 20 }, { growthStage: "compound_distribution", decisionCode: "distribute_expertise", questCategory: "distribution", urgency: "routine" }],
  ] as const)("returns %s consistently", async (input, growthStage) => {
    const { browser, worker } = await runBoth(input);
    expect(browser).toEqual(worker);
    expect(browser).toMatchObject(growthStage);
    expect(browser.weeklyQuest.length).toBeGreaterThan(10);
    expect(browser.explanation.length).toBeGreaterThan(20);
  });

  it("uses a market-neutral content quest for non-local websites", async () => {
    const { browser, worker } = await runBoth({ auditComplete: 1, criticalIssues: 0, warnings: 0, rankingKeywords: 804516, newKeywords: 32, lostKeywords: 0, contentGaps: 24, reviewCount: 0 });
    expect(browser).toEqual(worker);
    expect(browser.weeklyQuest).toBe("Publish the highest-opportunity page");
  });
});
