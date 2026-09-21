import { afterEach, describe, expect, it, vi } from "vitest";
import { DataForSeoResearchClient, parseKeywordResearch } from "./research";
import { parseKeywordRows } from "../../../supabase/functions/seo-research/logic";
const item = (keyword: string, volume: number | null) => ({ keyword, keyword_info: { search_volume: volume }, keyword_properties: { keyword_difficulty: 0 } });
const payload = (seed: unknown, items: unknown[]) => ({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ seed_keyword_data: seed, items }] }] });
afterEach(() => vi.unstubAllGlobals());
for (const [name, parse] of [["server", parseKeywordResearch], ["Edge", parseKeywordRows]] as const) {
  describe(`${name} exact keyword recovery`, () => {
    it("retains measured seed data when suggestions are empty", () => {
      expect(parse(payload(item("is chatgpt spying on me", 40), []))).toMatchObject([{ keyword: "is chatgpt spying on me", volume: 40, difficulty: 0 }]);
    });
    it("keeps differently worded phrases and their own measurements separate", () => {
      const rows = parse(payload(item("is chatgpt spying on me", 40), [item("is chatgpt spying on you", 20)]));
      expect(rows.map(row => [row.keyword, row.volume])).toEqual([["is chatgpt spying on me", 40], ["is chatgpt spying on you", 20]]);
    });
    it("does not duplicate a seed already present among suggestions", () => {
      const rows = parse(payload(item("Exact Phrase", 40), [item("exact phrase", 40), item("another phrase", 0)]));
      expect(rows).toHaveLength(2);
      expect(rows.map(row => row.volume)).toEqual([40, 0]);
    });
    it("preserves unavailable seed volume and measured zero separately", () => {
      expect(parse(payload(item("unknown phrase", null), [item("zero phrase", 0)])).map(row => row.volume)).toEqual([null, 0]);
    });
    it("does not invent a row when the seed is absent or malformed", () => {
      for (const seed of [null, {}, {keyword_info:{search_volume:40}}]) expect(parse(payload(seed, []))).toEqual([]);
    });
  });
}
it("explicitly requests exact seed data for keyword suggestions", async () => {
  const fetcher = vi.fn().mockResolvedValue({ok:true,json:async()=>payload(item("exact phrase",40),[])});
  vi.stubGlobal("fetch",fetcher);
  const report = await new DataForSeoResearchClient("fixture","fixture").keywordResearch({query:"exact phrase",mode:"keyword"});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)[0]).toMatchObject({keyword:"exact phrase",include_seed_keyword:true});
  expect(report.rows).toHaveLength(1);
});
