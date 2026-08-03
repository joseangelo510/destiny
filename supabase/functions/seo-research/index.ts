import { withSupabase } from "@supabase/server";
import { firstResult, normalizeDomain, parseBacklinks, parseKeywordRows, parseOrganicPerformance, summarizeKeywordRows } from "./logic.ts";

type ResearchRequest = {
  kind?: unknown;
  query?: unknown;
  mode?: unknown;
  locationName?: unknown;
  target?: unknown;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function authorization(login: string, password: string) {
  const bytes = new TextEncoder().encode(`${login}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

async function providerPost(path: string, body: Record<string, unknown>[], login: string, password: string) {
  const response = await fetch(`https://api.dataforseo.com${path}`, {
    method: "POST",
    headers: { Authorization: authorization(login, password), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DataForSEO returned HTTP ${response.status}.`);
  return response.json();
}

function ninetyDayStart() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 2);
  return start.toISOString().slice(0, 10);
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    let body: ResearchRequest;
    try { body = await request.json() as ResearchRequest; }
    catch { return json({ error: "Request body must be valid JSON." }, 400); }

    const login = Deno.env.get("DATAFORSEO_LOGIN")?.trim();
    const password = Deno.env.get("DATAFORSEO_PASSWORD")?.trim();
    if (!login || !password) return json({ error: "Live SEO research is not configured yet." }, 503);

    try {
      if (body.kind === "keywords") {
        if (typeof body.query !== "string" || (body.mode !== "keyword" && body.mode !== "domain")) {
          return json({ error: "Enter a keyword or domain and select a research mode." }, 400);
        }
        const location = typeof body.locationName === "string" && body.locationName.trim() ? body.locationName.trim() : "United States";
        const query = body.mode === "domain" ? normalizeDomain(body.query) : body.query.trim();
        if (query.length < 2 || query.length > 200) return json({ error: "Enter a keyword or public domain between 2 and 200 characters." }, 400);
        const path = body.mode === "domain" ? "/v3/dataforseo_labs/google/ranked_keywords/live" : "/v3/dataforseo_labs/google/keyword_suggestions/live";
        const providerBody = body.mode === "domain"
          ? { target: query, location_name: location, language_name: "English", item_types: ["organic"], order_by: ["keyword_data.keyword_info.search_volume,desc"], limit: 100 }
          : { keyword: query, location_name: location, language_name: "English", filters: ["keyword_info.search_volume", ">", 0], order_by: ["keyword_info.search_volume,desc"], limit: 100 };
        const [payload, historyPayload] = await Promise.all([
          providerPost(path, [providerBody], login, password),
          body.mode === "domain"
            ? providerPost("/v3/dataforseo_labs/google/historical_rank_overview/live", [{
              target: query,
              location_name: location,
              language_name: "English",
              date_from: ninetyDayStart(),
              correlate: true,
            }], login, password).catch(() => null)
            : Promise.resolve(null),
        ]);
        const rows = parseKeywordRows(payload);
        const providerResult = firstResult(payload);
        const providerTotal = typeof providerResult.total_count === "number" ? providerResult.total_count : 0;
        return json({
          sourceLabel: "Live DataForSEO keyword index", query, mode: body.mode, location, updatedAt: new Date().toISOString(),
          metrics: summarizeKeywordRows(rows, providerTotal), rows,
          performance: historyPayload ? parseOrganicPerformance(historyPayload) : [],
          notices: [
            "Search volume, difficulty, CPC, and traffic are third-party estimates and may differ from first-party Google data.",
            body.mode === "domain" ? "Positions show the domain's current organic rankings." : "Intent reflects the most likely purpose behind each search.",
          ],
        });
      }

      if (body.kind === "backlinks") {
        if (typeof body.target !== "string") return json({ error: "Enter a public domain." }, 400);
        const target = normalizeDomain(body.target);
        const [summary, links] = await Promise.all([
          providerPost("/v3/backlinks/summary/live", [{ target, include_subdomains: true, backlinks_status_type: "all", internal_list_limit: 10 }], login, password),
          providerPost("/v3/backlinks/backlinks/live", [{ target, include_subdomains: true, backlinks_status_type: "all", order_by: ["domain_from_rank,desc", "rank,desc"], limit: 100 }], login, password),
        ]);
        return json(parseBacklinks(summary, links, target));
      }

      return json({ error: "Select keyword or backlink research." }, 400);
    } catch (cause) {
      return json({ error: cause instanceof Error ? cause.message : "Destiny could not complete live SEO research." }, 502);
    }
  }),
};
