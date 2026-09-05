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
