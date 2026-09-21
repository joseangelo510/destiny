import { expect, it } from "vitest";
import { parseReoptimizationResearch } from "./research";

const payload = (items: unknown[]) => ({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items }] }] });
it("retains documented related-search strings in reoptimization evidence", () => {
  const empty = payload([]);
  const result = parseReoptimizationResearch({
    keyword: "synthetic screening", pageUrl: "https://example.com/screening", location: "United States",
    serpPayload: payload([{ type: "related_searches", title: "Related searches", items: [
      " <b>screening</b> status ", { title: "screening status" }, { keyword: "employment screening" }, null, " ",
    ] }]),
    currentPayload: empty, instantPayload: empty, backlinksPayload: empty, competitorPayloads: [],
  });
  expect(result.serp.relatedSearches).toEqual(["screening status", "employment screening"]);
});
