import { verifyWorkerRequest } from "../_shared/billing/worker-auth.ts";
import { meteredResponse } from "../_shared/billing/metered-work.ts";
import { withSupabase } from "@supabase/server";
import { runDomainOverview } from "./domain-overview.ts";
import { creatorSearchRequests, firstResult, normalizeDomain, organicHistoryWindowStart, parseArticleEvidence, parseBacklinks, parseCreatorSearchResults, parseKeywordRows, parseKeywordSerp, parseOrganicPerformance, summarizeKeywordRows } from "./logic.ts";

type ResearchRequest = {
  kind?: unknown;
  billingUsageId?: unknown;
  query?: unknown;
  mode?: unknown;
  locationName?: unknown;
  target?: unknown;
  topics?: unknown;
  excludeDomains?: unknown;
  keyword?: unknown;
  market?: unknown;
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

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const ownerId = context.userClaims?.id;
    if (!ownerId) return json({ error: "Sign in again to continue." }, 401);
    const raw = await request.text();
    let body: ResearchRequest;
    try { body = JSON.parse(raw) as ResearchRequest; }
    catch { return json({ error: "Request body must be valid JSON." }, 400); }

    if (body.kind === "article_evidence") {
      if (!await verifyWorkerRequest(raw, "seo-research", request.headers, Deno.env.get("BILLING_WORKER_SECRET") ?? "")) return json({ error: "Article reservation required." }, 403);
      if (typeof body.billingUsageId !== "string") return json({ error: "Article reservation required." }, 403);
      const { data: usage, error } = await context.supabaseAdmin.from("billing_usage").select("id").eq("id", body.billingUsageId).eq("owner_id", ownerId).eq("meter", "articles").eq("state", "reserved").gt("created_at", new Date(Date.now()-15*60_000).toISOString()).maybeSingle();
      if (error || !usage) return json({ error: "Article reservation is unavailable." }, 403);
    }
    const login = Deno.env.get("DATAFORSEO_LOGIN")?.trim();
    const password = Deno.env.get("DATAFORSEO_PASSWORD")?.trim();
    if (!login || !password) return json({ error: "Live SEO research is not configured yet." }, 503);

    const runResearch = async () => {
    try {
      if (body.kind === "domain_overview") {
        if (typeof body.target !== "string" || typeof body.market !== "string") return json({ error: "Enter a public domain and choose a country." }, 400);
        return json(await runDomainOverview(body.target, body.market, (path, items) => providerPost(path, items, login, password)));
      }
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
        const [payload, historyPayload, seedSerpPayload] = await Promise.all([
          providerPost(path, [providerBody], login, password),
          body.mode === "domain"
            ? providerPost("/v3/dataforseo_labs/google/historical_rank_overview/live", [{
              target: query,
              location_name: location,
              language_name: "English",
              date_from: organicHistoryWindowStart(),
              correlate: true,
            }], login, password).catch(() => null)
            : Promise.resolve(null),
          body.mode === "keyword"
            ? providerPost("/v3/serp/google/organic/live/advanced", [{ keyword: query, location_name: location, language_code: "en", depth: 10 }], login, password).catch(() => null)
            : Promise.resolve(null),
        ]);
        const rows = parseKeywordRows(payload);
        const providerResult = firstResult(payload);
        const providerTotal = typeof providerResult.total_count === "number" ? providerResult.total_count : 0;
        let seedSerp: ReturnType<typeof parseKeywordSerp> | null = null;
        if (seedSerpPayload) {
          try { seedSerp = parseKeywordSerp(seedSerpPayload, query, location); } catch { seedSerp = null; }
        }
        return json({
          sourceLabel: "Live DataForSEO keyword index", query, mode: body.mode, location, updatedAt: new Date().toISOString(),
          metrics: summarizeKeywordRows(rows, providerTotal), rows,
          performance: historyPayload ? parseOrganicPerformance(historyPayload) : [],
          ...(body.mode === "keyword" ? {
            questions: seedSerp?.questions ?? [],
            related: seedSerp?.related ?? [],
            serpCheckedAt: seedSerp?.checkedAt,
            serpEvidenceStatus: seedSerp ? "live" : "unavailable",
          } : {}),
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

      if (body.kind === "keyword_serp") {
        const keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 200) : "";
        if (keyword.length < 2) return json({ error: "Enter a keyword between 2 and 200 characters." }, 400);
        const location = typeof body.locationName === "string" && body.locationName.trim() ? body.locationName.trim() : "United States";
        const payload = await providerPost("/v3/serp/google/organic/live/advanced", [{ keyword, location_name: location, language_code: "en", depth: 10 }], login, password);
        return json(parseKeywordSerp(payload, keyword, location));
      }

      if (body.kind === "creators") {
        const topics = Array.isArray(body.topics) ? body.topics.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
        const excludeDomains = Array.isArray(body.excludeDomains) ? body.excludeDomains.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
        const location = typeof body.locationName === "string" && body.locationName.trim() ? body.locationName.trim() : "United States";
        const requests = creatorSearchRequests(topics, location);
        if (!requests.length) return json({ error: "Choose at least one priority keyword first." }, 400);
        const payload = await providerPost("/v3/serp/google/organic/live/advanced", requests, login, password);
        return json({
          sourceLabel: "Live DataForSEO creator discovery",
          updatedAt: new Date().toISOString(),
          topics,
          rows: parseCreatorSearchResults(payload, excludeDomains),
          notices: [
            "Results come from current public search evidence across Medium, YouTube, LinkedIn, Instagram, and independent blogs.",
            "Audience size must be verified before applying Rebound SEO's 3,000–100,000 follower target.",
            "Rebound SEO does not invent contact details. Any email must include the public source where it was found.",
          ],
        });
      }

      if (body.kind === "article_evidence") {
        const keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 200) : "";
        if (keyword.length < 2) return json({ error: "Choose a focus keyword before researching article evidence." }, 400);
        const location = typeof body.locationName === "string" && body.locationName.trim() ? body.locationName.trim() : "United States";
        const payload = await providerPost("/v3/serp/google/organic/live/advanced", [{ keyword, location_name: location, language_code: "en", depth: 20 }], login, password);
        const rows = parseArticleEvidence(payload, 5);
        if (rows.length < 3) return json({ error: "DataForSEO did not return enough credible sources for this article yet." }, 502);
        return json({ sourceLabel: "Live DataForSEO article evidence", updatedAt: new Date().toISOString(), keyword, location, rows });
      }

      return json({ error: "Select keyword, keyword SERP, backlink, creator, or article evidence research." }, 400);
    } catch (cause) {
      return json({ error: cause instanceof Error ? cause.message : "Rebound SEO could not complete live SEO research." }, 502);
    }
    };
    const meter = body.kind === "keywords" || body.kind === "keyword_serp" ? "keywordSearches"
      : body.kind === "domain_overview" || body.kind === "backlinks" ? "domainReports" : null;
    if (!meter) return runResearch();
    const suppliedKey = request.headers.get("idempotency-key");
    if (suppliedKey && !/^[a-zA-Z0-9_-]{8,160}$/.test(suppliedKey)) return json({ error: "Invalid request identifier." }, 400);
    return meteredResponse(context.supabaseAdmin, { ownerId, meter, requestKey: `research-${String(body.kind)}-${suppliedKey ?? crypto.randomUUID()}` }, runResearch);
  }),
};
