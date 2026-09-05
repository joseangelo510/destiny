import { describe, expect, it, vi } from "vitest";
import { deterministicBusinessSearchBrief } from "../../../supabase/functions/process-audit/business-search-brief";
import { discoverNewKeywordRecommendations } from "./new-keyword-recommendations";
const business = { productsServices: "YouTube marketing services, SEO services and Google Ads management", idealCustomer: "B2B SaaS companies", problemSolved: "Improve search visibility and fix Google Ads conversions" };
const brief = deterministicBusinessSearchBrief(business);
const input = { domain: "example.com", business, brief, pages: [], existingKeywords: [] };
const angles = ["strategy", "cost", "analytics", "checklist", "benchmarks", "reporting", "attribution", "conversion", "budget", "audit", "planning", "measurement", "mistakes", "examples", "roi", "retargeting", "targeting", "optimization", "funnel", "engagement"];
const row = (keyword: string) => ({ keyword, volume: 100, intent: "informational" as const, difficulty: 20, cpc: 2, competition: 0, trend: [], position: 0, traffic: 0, url: "" });
describe("recommendation depth", () => {
  it("replenishes covered candidates and provides fifteen distinct topics plus a reserve", async () => {
    const rows = angles.map(angle => row(`youtube marketing ${angle}`));
    const result = await discoverNewKeywordRecommendations(input, {
      research: vi.fn().mockResolvedValue({ rows, updatedAt: "2026-09-05" }),
      coverage: vi.fn(async (keyword: string) => ({ checkedAt: "2026-09-05", pages: keyword.endsWith("strategy") ? [{ url: "https://example.com/strategy", title: keyword }] : [] })),
    });
    expect(result.keywords.length).toBeGreaterThanOrEqual(15);
    expect(result.keywords.some(k => k.keyword.endsWith("strategy"))).toBe(false);
    expect(new Set(result.keywords.map(k => k.keyword)).size).toBe(result.keywords.length);
  });
  it("expands beyond the first provider pass when it yields too few options", async () => {
    const research = vi.fn(async (_seed: string, options?: { related: boolean }) => ({ rows: options?.related ? angles.map(angle => row(`youtube marketing ${angle}`)) : [row("youtube marketing strategy")], updatedAt: "2026-09-05" }));
    const result = await discoverNewKeywordRecommendations(input, { research, coverage: vi.fn().mockResolvedValue({ pages: [], checkedAt: "2026-09-05" }) });
    expect(research.mock.calls.some(([, options]) => options?.related)).toBe(true);
    expect(result.keywords.length).toBeGreaterThanOrEqual(15);
  });
  it("uses structured offers omitted from old theme seeds", async () => {
    const research = vi.fn().mockResolvedValue({ rows: [], updatedAt: "2026-09-05" });
    await discoverNewKeywordRecommendations({ ...input, brief: { ...brief, offerVsEnablement: { ...brief.offerVsEnablement, whatCompanySells: [...brief.offerVsEnablement.whatCompanySells, "Generative engine optimization services"] } } }, { research, coverage: vi.fn() });
    expect(research.mock.calls.some(([seed]) => /generative engine optimization/i.test(seed))).toBe(true);
  });
});
