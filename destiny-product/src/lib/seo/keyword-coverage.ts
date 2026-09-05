import "server-only";
import { normalizeWebsite } from "./url";
import type { Coverage } from "./new-keyword-recommendations";

export async function checkKeywordCoverage(keyword: string, website: string): Promise<Coverage> {
  const domain = normalizeWebsite(website).domain;
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("Live keyword coverage is unavailable.");
  const response = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ keyword: `site:${domain} ${keyword}`, location_name: "United States", language_code: "en", depth: 10 }]),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("Keyword coverage could not be checked.");
  const payload = await response.json() as { status_code?: number; tasks?: Array<{ status_code?: number; result?: Array<{ items?: Array<{ type?: string; url?: string; title?: string }> }> }> };
  const task = payload.tasks?.[0];
  const result = task?.result?.[0];
  if (payload.status_code !== 20000 || task?.status_code !== 20000 || !result || !Array.isArray(result.items)) throw new Error("Keyword coverage evidence is incomplete.");
  const pages = result.items.flatMap((item) => {
    if (item.type !== "organic" || !item.url) return [];
    try {
      const url = new URL(item.url);
      const host = url.hostname.replace(/^www\./, "");
      return (host === domain || host.endsWith(`.${domain}`)) && /^https?:$/.test(url.protocol) ? [{ url: url.href, title: item.title ?? "" }] : [];
    } catch { return []; }
  });
  return { pages, checkedAt: new Date().toISOString() };
}
