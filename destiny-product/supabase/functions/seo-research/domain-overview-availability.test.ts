import { expect, it } from "vitest";
import { runDomainOverview } from "./domain-overview";

it("reports aggregated AI evidence as available when the endpoint returns an empty items list", async () => {
  const report = await runDomainOverview("example.com", "US", async (path) => ({
    status_code: 20000,
    tasks: [{ status_code: 20000, result: [path.includes("llm_mentions") ? {
      items: [], total_count: 0,
      aggregated_metrics: { platform: [{ key: "chat_gpt", mentions: 2, ai_search_volume: 26 }] },
    } : { items: [] }] }],
  }));
  expect(report.ai.mentions).toBe(2);
  expect(report.sections.ai.state).toBe("available");
});

it("retains empty AI state when no aggregate evidence exists", async () => {
  const report = await runDomainOverview("example.com", "US", async () => ({
    status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [], aggregated_metrics: null }] }],
  }));
  expect(report.ai.mentions).toBeNull();
  expect(report.sections.ai.state).toBe("empty");
});
