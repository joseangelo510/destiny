export type KeywordStrategyVerdict = "improve" | "create" | "defend" | "overlap";

export function keywordStrategyAction(input: { rank: number; rankBucket: number; rankingUrls: string[] }): { verdict: KeywordStrategyVerdict; description: string } {
  const urls = [...new Set(input.rankingUrls.map((url) => url.trim()).filter(Boolean))];
  if (urls.length > 1) return { verdict: "overlap", description: `${urls.length} pages may be splitting relevance` };
  if (input.rankBucket === 1 || (input.rank > 0 && input.rank <= 3)) return { verdict: "defend", description: "Already winning · protect this page" };
  if (urls.length || input.rank > 0) {
    return {
      verdict: "improve",
      description: input.rank > 3 && input.rank <= 20 ? "Page two · a practical quick win" : "An existing page can be improved",
    };
  }
  return { verdict: "create", description: "No page is verified for this search" };
}
