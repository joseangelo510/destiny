import { describe, expect, it, vi } from "vitest";
import { discoverNewKeywordRecommendations, topicMatches } from "./new-keyword-recommendations";
import { deterministicBusinessSearchBrief } from "../../../supabase/functions/process-audit/business-search-brief";

const business = { businessName: "Studio", productsServices: "YouTube marketing services and YouTube advertising", idealCustomer: "B2B SaaS marketing teams", problemSolved: "Help teams plan YouTube marketing strategy and measure advertising performance" };
const brief = deterministicBusinessSearchBrief(business);
const row = (keyword: string, volume = 100) => ({ keyword, volume, intent: "informational" as const, difficulty: 20, cpc: 4, competition: 0, trend: [], position: 0, traffic: 0, url: "" });
const input = { business, brief, domain: "example.com", existingKeywords: Array.from({ length: 25 }, (_, i) => ({ keyword: `existing service ${i}`, rank: 12, url: "https://example.com/services" })), pages: [] };

describe("new content recommendations", () => {
  it("researches from the existing business brief despite a full existing strategy", async () => {
    const research = vi.fn().mockResolvedValue({ rows: [row("youtube marketing strategy"), row("youtube advertising cost")], updatedAt: "2026-09-04T00:00:00Z" });
    const coverage = vi.fn().mockResolvedValue({ pages: [], checkedAt: "2026-09-04T00:00:00Z" });
    const result = await discoverNewKeywordRecommendations(input, { research, coverage });
    expect(research).toHaveBeenCalled();
    expect(result.keywords.length).toBeGreaterThan(0);
    expect(result.keywords.every((keyword) => keyword.searchVolume > 0 && keyword.coverageCheckedAt)).toBe(true);
    expect(coverage).toHaveBeenCalled();
    expect(result.keywords[0].priorityReason).toBeTruthy();
  });
  it("excludes covered topics, existing ranks, duplicates and unmeasured demand", async () => {
    const result = await discoverNewKeywordRecommendations({ ...input, existingKeywords: [{ keyword: "youtube advertising cost", rank: 9, url: "https://example.com/ads" }] }, {
      research: vi.fn().mockResolvedValue({ rows: [row("youtube marketing strategy"), row("YouTube marketing strategy"), row("youtube advertising cost"), row("youtube marketing analytics", 0)], updatedAt: "2026-09-04T00:00:00Z" }),
      coverage: vi.fn().mockResolvedValue({ pages: [{ title: "YouTube Marketing Strategy", url: "https://example.com/blog/youtube-marketing-strategy" }], checkedAt: "2026-09-04T00:00:00Z" }),
    });
    expect(result.keywords).toEqual([]);
  });
  it("does not turn a failed coverage request into a new-content claim", async () => {
    const result = await discoverNewKeywordRecommendations(input, {
      research: vi.fn().mockResolvedValue({ rows: [row("youtube marketing strategy")], updatedAt: "2026-09-04T00:00:00Z" }),
      coverage: vi.fn().mockRejectedValue(new Error("Provider unavailable")),
    });
    expect(result.keywords).toEqual([]);
    expect(result.status).toBe("unavailable");
  });
  it("reports provider failure honestly and caps discovery work", async () => {
    const research = vi.fn().mockRejectedValue(new Error("No provider"));
    const result = await discoverNewKeywordRecommendations(input, { research, coverage: vi.fn() });
    expect(result.keywords).toEqual([]);
    expect(result.status).toBe("unavailable");
    expect(research.mock.calls.length).toBeLessThanOrEqual(6);
  });
  it("groups reordered phrases and plural variants without swallowing distinct intent", () => {
    expect(topicMatches("youtube marketing strategies", "Marketing strategy for YouTube")).toBe(true);
    expect(topicMatches("youtube advertising cost", "YouTube advertising agency")).toBe(false);
  });
});
