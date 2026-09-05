import { afterEach, expect, it, vi } from "vitest";
import { DataForSeoResearchClient } from "./research";
afterEach(() => vi.unstubAllGlobals());
it("queries additional provider pages and related searches rather than repeating the first results", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [] }] }] }) });
  vi.stubGlobal("fetch", fetcher);
  const client = new DataForSeoResearchClient("test", "test");
  await client.keywordResearch({ query: "conversion rate optimization", mode: "keyword", offset: 100 });
  await client.keywordResearch({ query: "conversion rate optimization", mode: "keyword", related: true, offset: 100 });
  expect(fetcher.mock.calls[0][0]).toContain("keyword_suggestions/live");
  expect(fetcher.mock.calls[1][0]).toContain("related_keywords/live");
  for (const [, request] of fetcher.mock.calls) expect(JSON.parse(request.body)[0].offset).toBe(100);
});
