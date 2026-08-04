import { describe, expect, it } from "vitest";
import { parseRankObservation } from "../../../supabase/functions/rank-tracker-refresh/logic";

describe("DataForSEO rank evidence parser", () => {
  it("uses organic group rank and matches www or root domains", () => {
    const result = parseRankObservation({ tasks: [{ id: "task-1", status_code: 20000, cost: 0.006, result: [{ datetime: "2026-08-03 17:00:00 +00:00", check_url: "https://google.com/check", se_domain: "google.com", items: [
      { type: "featured_snippet", rank_group: 1, domain: "example.com", url: "https://example.com/snippet" },
      { type: "organic", rank_group: 4, rank_absolute: 7, domain: "www.example.com", url: "https://www.example.com/services", title: "Services" },
    ] }] }] }, "example.com");
    expect(result).toMatchObject({ found: true, position: 4, resultUrl: "https://www.example.com/services", providerTaskId: "task-1", checkUrl: "https://google.com/check" });
  });

  it("records a completed miss as not found rather than rank zero", () => {
    const result = parseRankObservation({ tasks: [{ status_code: 20000, result: [{ items: [{ type: "organic", rank_group: 1, domain: "competitor.com" }] }] }] }, "example.com");
    expect(result).toMatchObject({ found: false, position: null, resultUrl: null });
  });

  it("counts subdomains but rejects lookalike domains", () => {
    const result = parseRankObservation({ tasks: [{ status_code: 20000, result: [{ items: [
      { type: "organic", rank_group: 2, domain: "notexample.com", url: "https://notexample.com" },
      { type: "organic", rank_group: 6, domain: "blog.example.com", url: "https://blog.example.com/guide" },
    ] }] }] }, "example.com");
    expect(result).toMatchObject({ found: true, position: 6, resultUrl: "https://blog.example.com/guide" });
  });

  it("rejects provider task failures", () => {
    expect(() => parseRankObservation({ tasks: [{ status_code: 40501, status_message: "Invalid field" }] }, "example.com")).toThrow("Invalid field");
  });
});
