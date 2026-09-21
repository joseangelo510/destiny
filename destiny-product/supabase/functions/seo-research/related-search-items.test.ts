import { describe, expect, it } from "vitest";
import { parseKeywordSerp } from "./logic";

function parse(items: unknown[]) {
  return parseKeywordSerp({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items }] }] },
    "synthetic background check", "United States", new Date("2026-09-21T19:00:00Z"));
}

describe("documented related-search response shape", () => {
  it("retains provider string items alongside existing first-page evidence", () => {
    const result = parse([
      { type: "related_searches", items: ["employment screening timing", "background check status"] },
      { type: "people_also_ask", items: [{ title: "How long does screening take?" }] },
      { type: "organic", rank_group: 1, title: "Screening guide", url: "https://example.com/guide" },
    ]);
    expect(result.related).toEqual(["employment screening timing", "background check status"]);
    expect(result.questions).toEqual(["How long does screening take?"]);
    expect(result.organic).toHaveLength(1);
    expect(result).toMatchObject({ keyword: "synthetic background check", location: "United States", checkedAt: "2026-09-21T19:00:00.000Z" });
  });

  it("cleans and deduplicates strings and object items without returning container metadata", () => {
    expect(parse([{ type: "related_searches", title: "Related searches", xpath: "/page/related", items: [
      " <b>background</b>   checks ", { title: "background checks" }, { keyword: "screening status" },
      " ", null, 17, { url: "https://example.com/not-a-keyword" },
    ] }]).related).toEqual(["background checks", "screening status"]);
  });

  it("keeps the twelve unique suggestion limit across provider blocks", () => {
    const first = Array.from({ length: 10 }, (_, index) => `suggestion ${index}`);
    const second = Array.from({ length: 10 }, (_, index) => `suggestion ${index + 8}`);
    expect(parse([{ type: "related_searches", items: first }, { type: "related_searches", items: second }]).related)
      .toEqual(Array.from({ length: 12 }, (_, index) => `suggestion ${index}`));
  });

  it("does not turn unrelated SERP strings or absent related data into suggestions", () => {
    expect(parse([{ type: "organic", items: ["unrelated content"] }, { type: "related_searches", items: null }]).related).toEqual([]);
  });
});
