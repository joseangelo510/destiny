import { describe, expect, it, vi } from "vitest";
import { domainOverviewRequests, runDomainOverview } from "./domain-overview";

const payload = (result: unknown) => ({ status_code: 20000, tasks: [{ status_code: 20000, result: [result] }] });
const metrics = { organic: { etv: 903, count: 1100, pos_1: 3, pos_2_3: 7, pos_4_10: 20 }, paid: { etv: 30, count: 2 } };

describe("Domain Overview provider contract", () => {
  it("normalizes domains and rejects local targets before any paid requests", async () => {
    expect(domainOverviewRequests("https://www.example.com/page", "US").target).toBe("example.com");
    const post = vi.fn();
    await expect(runDomainOverview("http://localhost", "US", post)).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
    expect(() => domainOverviewRequests("example.com", "invented")).toThrow();
  });

  it("uses full provider totals, never sums the keyword sample, and keeps global backlinks scoped", async () => {
    const post = vi.fn(async (path: string) => {
      if (path.includes("domain_rank_overview")) return payload({ items: [{ location_code: 2840, language_code: "en", metrics }, { location_code: 2826, language_code: "en", metrics: { organic: { etv: 100, count: 70 } } }] });
      if (path.includes("backlinks/summary")) return payload({ rank: 26, backlinks: 2095, referring_domains: 652 });
      if (path.includes("historical_rank")) return payload({ items: [{ year: 2026, month: 8, metrics }, { year: 2026, month: 7, metrics: { organic: { etv: 800, count: 1000 } } }] });
      return payload({ items: [] });
    });
    const report = await runDomainOverview("example.com", "US", post);
    expect(report.summary.organicTraffic).toBe(903);
    expect(report.summary.organicKeywords).toBe(1100);
    expect(report.summary.paidTraffic).toBe(30);
    expect(report.summary.rank).toBe(26);
    expect(report.summary.backlinks).toBe(2095);
    expect(report.history.map(row => row.date)).toEqual(["2026-07-01", "2026-08-01"]);
    expect(report.countries).toHaveLength(2);
    expect(post.mock.calls.find(([path]) => path.includes("backlinks/summary"))?.[1]).toEqual([{ target: "example.com", include_subdomains: true, backlinks_status_type: "live", rank_scale: "one_hundred", internal_list_limit: 10 }]);
  });

  it("preserves missing data as null and successful zero independently of failed sections", async () => {
    const report = await runDomainOverview("example.com", "US", async (path: string) => {
      if (path.includes("domain_rank_overview")) return payload({ items: [{ location_code: 2840, metrics: { organic: { etv: 0, count: 0 }, paid: null } }] });
      throw new Error("quota exhausted");
    });
    expect(report.summary.organicTraffic).toBe(0);
    expect(report.summary.paidTraffic).toBeNull();
    expect(report.summary.backlinks).toBeNull();
    expect(report.sections.backlinks.state).toBe("unavailable");
    expect(report.sections.overview.state).toBe("available");
  });

  it("handles provider HTTP-200 task errors without inventing zero results", async () => {
    const report = await runDomainOverview("example.com", "US", async () => ({ status_code: 20000, tasks: [{ status_code: 40200, status_message: "Payment required" }] }));
    expect(report.summary.organicTraffic).toBeNull();
    expect(report.sections.overview.state).toBe("unavailable");
    expect(report.status).toBe("unavailable");
  });

  it("keeps SEO and AI location filters aligned and caps request count", () => {
    const plan = domainOverviewRequests("example.com", "DE");
    expect(plan.requests.history.body[0]).toMatchObject({ location_code: 2276, language_code: "de" });
    expect(plan.requests.ai.body[0]).toMatchObject({ location_code: 2276, language_code: "de" });
    expect(Object.keys(plan.requests).length).toBeLessThanOrEqual(12);
  });
});
