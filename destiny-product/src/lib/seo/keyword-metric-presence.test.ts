import { describe, expect, it } from "vitest";
import { parseKeywordResearch, summarizeKeywordResearch } from "./research";
import { parseKeywordRows, summarizeKeywordRows, keywordReportMetrics } from "../../../supabase/functions/seo-research/logic";

const payload = (items: unknown[]) => ({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items }] }] });
const input = payload([
  { keyword: "known positive", keyword_info: { search_volume: 100, cpc: 1.25, competition: 0.5 }, keyword_properties: { keyword_difficulty: 20 } },
  { keyword: "measured zero", keyword_info: { search_volume: 0, cpc: 0, competition: 0 }, keyword_properties: { keyword_difficulty: 0 } },
  { keyword: "unknown", keyword_info: { search_volume: null, cpc: "", competition: null }, keyword_properties: { keyword_difficulty: null } },
]);

describe.each([
  { name: "server", parse: parseKeywordResearch, summarize: summarizeKeywordResearch },
  { name: "Edge", parse: parseKeywordRows, summarize: summarizeKeywordRows },
])("$name keyword metric presence", ({ parse, summarize }) => {
  it("distinguishes missing metrics from measured zero", () => {
    const rows = parse(input);
    expect(rows[0]).toMatchObject({ volume: 100, difficulty: 20, cpc: 1.25, competition: 0.5 });
    expect(rows[1]).toMatchObject({ volume: 0, difficulty: 0, cpc: 0, competition: 0 });
    expect(rows[2]).toMatchObject({ volume: null, difficulty: null, cpc: null, competition: null, traffic: null });
  });

  it("averages only reported difficulty while retaining a real zero", () => {
    expect(summarize(parse(input), 399)).toMatchObject({ totalKeywords: 399, totalVolume: 100, averageDifficulty: 10, estimatedTraffic: null });
  });

  it("does not label an entirely unmeasured report as zero", () => {
    const rows = parse(payload([{ keyword: "unknown" }]));
    expect(summarize(rows)).toMatchObject({ totalVolume: null, averageDifficulty: null, estimatedTraffic: null });
  });
});


describe("keyword metric response compatibility", () => {
  it("keeps numeric fields for an older browser without opt-in", () => {
    const report = keywordReportMetrics(parseKeywordRows(input), 399);
    expect(report.rows[2]).toMatchObject({ volume: 0, difficulty: 0, cpc: 0, competition: 0, traffic: 0 });
    expect(report.metrics).toMatchObject({ totalVolume: 100, averageDifficulty: 7, estimatedTraffic: 0 });
  });
  it("returns nullable measurements only for the explicit v2 contract", () => {
    const rows = parseKeywordRows(input);
    expect(keywordReportMetrics(rows, 399, 2)).toEqual({ rows, metrics: summarizeKeywordRows(rows, 399) });
    expect(keywordReportMetrics(rows, 399, "2").rows[2].volume).toBe(0);
  });
});
