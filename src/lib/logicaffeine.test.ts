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
    [{ auditComplete: 0, criticalIssues: 0, rankingKeywords: 0, contentGaps: 0, reviewCount: 0 }, "audit_in_progress"],
    [{ auditComplete: 1, criticalIssues: 2, rankingKeywords: 40, contentGaps: 0, reviewCount: 30 }, "fix_foundations"],
    [{ auditComplete: 1, criticalIssues: 0, rankingKeywords: 7, contentGaps: 8, reviewCount: 20 }, "build_search_coverage"],
    [{ auditComplete: 1, criticalIssues: 0, rankingKeywords: 22, contentGaps: 0, reviewCount: 20 }, "compound_distribution"],
  ] as const)("returns %s consistently", async (input, growthStage) => {
    const { browser, worker } = await runBoth(input);
    expect(browser).toEqual(worker);
    expect(browser.growthStage).toBe(growthStage);
    expect(browser.weeklyQuest.length).toBeGreaterThan(10);
  });

  it("uses a market-neutral content quest for non-local websites", async () => {
    const { browser, worker } = await runBoth({ auditComplete: 1, criticalIssues: 0, rankingKeywords: 804516, contentGaps: 24, reviewCount: 0 });
    expect(browser).toEqual(worker);
    expect(browser.weeklyQuest).toBe("Publish the highest-opportunity page");
  });
});
