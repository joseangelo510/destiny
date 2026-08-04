type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export type DistributionOpportunity = {
  platform: "Reddit" | "Quora";
  topic: string;
  title: string;
  url: string;
  snippet: string;
  checkedAt: string;
};

export function parseDistributionSerp(payload: unknown, topic: string): DistributionOpportunity[] {
  const root = record(payload);
  const task = record(list(root.tasks)[0]);
  if (root.status_code !== 20000 || task.status_code !== 20000) return [];
  const result = record(list(task.result)[0]);
  const checkedAt = new Date().toISOString();
  return list(result.items).map(record).flatMap((item) => {
    if (item.type !== "organic") return [];
    const rawUrl = text(item.url);
    let url: URL;
    try { url = new URL(rawUrl); } catch { return []; }
    const host = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
    const isReddit = host === "reddit.com" && /\/comments\/[a-z0-9]+\//i.test(url.pathname);
    const isQuora = host === "quora.com" && url.pathname.length > 2 && !/^\/(?:search|topic|profile)(?:\/|$)/i.test(url.pathname);
    if (!isReddit && !isQuora) return [];
    return [{
      platform: isReddit ? "Reddit" as const : "Quora" as const,
      topic,
      title: text(item.title) || topic,
      url: url.toString(),
      snippet: text(item.description).slice(0, 300),
      checkedAt,
    }];
  });
}
