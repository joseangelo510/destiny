import { expect, it, vi } from "vitest";
import { recoverDiscoveryPool, retainDiscoveryOrder } from "./keyword-discovery-recovery";
it("keeps earlier recommendations when the next provider batch fails", async () => {
  const earlier = { keywords: [{ keyword: "google ads campaign budget" }], status: "ready" as const };
  const load = vi.fn(async (round: number) => { if (round === 1) throw new Error("Provider offline"); return earlier; });
  const result = await recoverDiscoveryPool(load, 1);
  expect(result.keywords).toEqual(earlier.keywords);
  expect(result.status).toBe("unavailable");
  expect(load.mock.calls.map(([round]) => round)).toEqual([1, 0]);
});
it("does not let preference score boosts undo the diverse discovery order", () => {
  const original = [{ keyword: "CRO audit" }, { keyword: "SEO pricing" }, { keyword: "GEO strategy" }];
  expect(retainDiscoveryOrder(original, [original[2], original[0]])).toEqual([original[0], original[2]]);
});
it("automatically replenishes the visible options when saved decisions leave fewer than fifteen", async () => {
  const { loadSufficientDiscovery } = await import("./keyword-discovery-recovery");
  const load = vi.fn(async (round: number) => ({ keywords: Array.from({ length: round ? 30 : 15 }, (_, i) => ({ keyword: `topic ${i}` })), status: "ready" as const }));
  const result = await loadSufficientDiscovery(load, pool => pool.keywords.length - 11, 0);
  expect(result.round).toBe(1);
  expect(result.keywords.length - 11).toBeGreaterThanOrEqual(15);
  expect(load.mock.calls.map(([round]) => round)).toEqual([0, 1]);
});
