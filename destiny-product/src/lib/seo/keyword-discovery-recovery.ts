export function retainDiscoveryOrder<T extends { keyword: string }>(original: T[], personalized: T[]) {
  const order = new Map(original.map((keyword, index) => [keyword.keyword, index]));
  return [...personalized].sort((left, right) => (order.get(left.keyword) ?? 9999) - (order.get(right.keyword) ?? 9999));
}

export async function recoverDiscoveryPool<T extends { keywords: unknown[]; status: "ready" | "unavailable" }>(load: (round: number) => Promise<T>, round: number): Promise<T> {
  for (let current = round; current >= 0; current--) {
    try {
      const result = await load(current);
      return current === round ? result : { ...result, status: "unavailable" };
    } catch (error) {
      if (current === 0) throw error;
    }
  }
  throw new Error("Keyword research is unavailable.");
}

export async function loadSufficientDiscovery<T extends { keywords: unknown[]; status: "ready" | "unavailable" }>(load: (round: number) => Promise<T>, pendingCount: (pool: T) => number, round: number): Promise<T & { round: number }> {
  let pool = await recoverDiscoveryPool(load, round);
  while (pendingCount(pool) < 15 && pool.status === "ready" && round < 5) {
    const previousCount = pool.keywords.length;
    pool = await recoverDiscoveryPool(load, ++round);
    // Avoid spinning on an exhausted index; manual discovery remains available.
    if (pool.keywords.length <= previousCount) break;
  }
  return { ...pool, round };
}
