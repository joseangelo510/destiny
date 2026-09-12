type Row = Record<string, unknown>;
export const DOMAIN_MARKETS = {
  US: { label: "United States", code: 2840, language: "en" },
  UK: { label: "United Kingdom", code: 2826, language: "en" },
  DE: { label: "Germany", code: 2276, language: "de" },
  CA: { label: "Canada", code: 2124, language: "en" },
  AU: { label: "Australia", code: 2036, language: "en" },
  FR: { label: "France", code: 2250, language: "fr" },
  ES: { label: "Spain", code: 2724, language: "es" },
} as const;
export type Market = keyof typeof DOMAIN_MARKETS;
export type Section = { state: "available" | "empty" | "unavailable"; message?: string; total: number | null };
export type RequestPlan = { path: string; body: Row[] };
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown) => Array.isArray(value) ? value.map(row) : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const sum = (values: (number | null)[]) => values.length && values.every(value => value !== null) ? values.reduce<number>((total, value) => total + (value ?? 0), 0) : null;
function firstResult(payload: unknown) {
  const root = row(payload), task = rows(root.tasks)[0];
  if (root.status_code !== 20000 || task?.status_code !== 20000) throw new Error("Provider request failed.");
  return rows(task.result)[0] ?? {};
}
export function publicDomain(value: string) {
  const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
  const domain = url.hostname.toLowerCase().replace(/^www\./, "");
  if (url.username || url.password || url.port) throw new Error("Enter a valid public domain.");
  if (domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) || /\.(localhost|local|internal|test|invalid)$/.test(domain)) throw new Error("Enter a valid public domain.");
  return domain;
}

export function domainOverviewRequests(input: string, selected: string) {
  const target = publicDomain(input);
  if (!(Object.hasOwn(DOMAIN_MARKETS, selected))) throw new Error("Choose a supported country.");
  const market = DOMAIN_MARKETS[selected as Market];
  const location = { location_code: market.code, language_code: market.language };
  const base = { target, ...location };
  const labs = (name: string, body: Row): RequestPlan => ({ path: `/v3/dataforseo_labs/google/${name}/live`, body: [body] });
  const links = (name: string, extra: Row = {}): RequestPlan => ({ path: `/v3/backlinks/${name}/live`, body: [{ target, include_subdomains: true, backlinks_status_type: "live", rank_scale: "one_hundred", ...extra }] });
  return { target, market: selected as Market, requests: {
    overview: labs("domain_rank_overview", { target, limit: 1000 }),
    history: labs("historical_rank_overview", { ...base, correlate: true, date_from: "2020-10-01" }),
    keywords: labs("ranked_keywords", { ...base, item_types: ["organic"], limit: 100, order_by: ["ranked_serp_element.serp_item.etv,desc"] }),
    paidKeywords: labs("ranked_keywords", { ...base, item_types: ["paid"], limit: 100, order_by: ["ranked_serp_element.serp_item.etv,desc"] }),
    pages: labs("relevant_pages", { ...base, limit: 20, order_by: ["metrics.organic.etv,desc"] }),
    competitors: labs("competitors_domain", { ...base, item_types: ["organic"], exclude_top_domains: true, limit: 20 }),
    backlinks: links("summary", { internal_list_limit: 10 }),
    links: links("backlinks", { limit: 50, order_by: ["rank,desc"] }),
    anchors: links("anchors", { limit: 20, order_by: ["backlinks,desc"] }),
    referring: links("referring_domains", { limit: 20, order_by: ["rank,desc"] }),
    ai: { path: "/v3/ai_optimization/llm_mentions/target_metrics/live", body: [{ target: [{ domain: target, search_filter: "include" }], ...location, internal_list_limit: 10 }] },
  } };
}

function metrics(value: unknown) {
  const root = row(value), organic = row(root.organic), paid = row(root.paid);
  return { organicTraffic: number(organic.etv), organicKeywords: number(organic.count), paidTraffic: number(paid.etv), paidKeywords: number(paid.count), trafficValue: number(organic.estimated_paid_traffic_cost), paidCost: number(paid.estimated_paid_traffic_cost) };
}
function positions(value: unknown) {
  const r = row(value);
  return [{ label: "Top 3", value: sum([number(r.pos_1), number(r.pos_2_3)]) }, { label: "4–10", value: number(r.pos_4_10) }, { label: "11–20", value: number(r.pos_11_20) }, { label: "21–50", value: sum([number(r.pos_21_30), number(r.pos_31_40), number(r.pos_41_50)]) }, { label: "51–100", value: sum([number(r.pos_51_60), number(r.pos_61_70), number(r.pos_71_80), number(r.pos_81_90), number(r.pos_91_100)]) }];
}
function keywordRows(result: Row) {
  return rows(result.items).map(item => {
    const data = row(item.keyword_data), info = row(data.keyword_info), properties = row(data.keyword_properties), serp = row(row(item.ranked_serp_element).serp_item);
    return { keyword: text(data.keyword), volume: number(info.search_volume), cpc: number(info.cpc), difficulty: number(properties.keyword_difficulty), intent: text(row(data.search_intent_info).main_intent) || "Unknown", position: number(serp.rank_group), traffic: number(serp.etv), url: safeUrl(serp.url), title: text(serp.title), description: text(serp.description) };
  }).filter(item => item.keyword);
}
function safeUrl(value: unknown) {
  try { const url = new URL(text(value)); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}

export async function runDomainOverview(input: string, selected: string, post: (path: string, body: Row[]) => Promise<unknown>) {
  const plan = domainOverviewRequests(input, selected), sections: Record<string, Section> = {}, results: Record<string, Row> = {};
  await Promise.all(Object.entries(plan.requests).map(async ([key, request]) => {
    try {
      const result = firstResult(await post(request.path, request.body));
      results[key] = result;
      const hasData = key === "ai" ? Object.keys(row(result.aggregated_metrics)).length > 0 : "items" in result ? rows(result.items).length > 0 : Object.keys(result).length > 0;
      sections[key] = { state: hasData ? "available" : "empty", total: number(result.total_count) };
    } catch {
      sections[key] = { state: "unavailable", message: "This data could not be retrieved. Try again later.", total: null };
      results[key] = {};
    }
  }));
  const countryRows = rows(results.overview.items);
  const selectedRow = countryRows.find(item => item.location_code === DOMAIN_MARKETS[plan.market].code && (!item.language_code || item.language_code === DOMAIN_MARKETS[plan.market].language));
  const current = row(selectedRow?.metrics), organic = row(current.organic), backlink = results.backlinks;
  const platforms = rows(row(results.ai.aggregated_metrics).platform).map(item => ({ platform: ({ chat_gpt: "ChatGPT", google: "Google AI Overviews" } as Record<string, string>)[text(item.key)] || text(item.key), mentions: number(item.mentions), searchVolume: number(item.ai_search_volume) }));
  return {
    target: plan.target, market: plan.market, marketLabel: DOMAIN_MARKETS[plan.market].label, language: DOMAIN_MARKETS[plan.market].language,
    retrievedAt: new Date().toISOString(), source: "DataForSEO", status: Object.values(sections).every(section => section.state === "unavailable") ? "unavailable" : Object.values(sections).some(section => section.state === "unavailable") ? "partial" : "available",
    sections, summary: { ...metrics(current), rank: number(backlink.rank), backlinks: number(backlink.backlinks), referringDomains: number(backlink.referring_domains), spamScore: number(backlink.backlinks_spam_score) },
    movement: { new: number(organic.is_new), improved: number(organic.is_up), declined: number(organic.is_down), lost: number(organic.is_lost) },
    positions: positions(organic),
    countries: countryRows.map(item => ({ code: number(item.location_code), language: text(item.language_code), ...metrics(item.metrics) })).sort((a,b) => (b.organicTraffic ?? -1) - (a.organicTraffic ?? -1)),
    history: rows(results.history.items).filter(item => number(item.year) && number(item.month) && Number(item.month) <= 12).map(item => ({ date: `${item.year}-${String(item.month).padStart(2,"0")}-01`, ...metrics(item.metrics), positions: positions(row(item.metrics).organic) })).sort((a,b) => a.date.localeCompare(b.date)),
    keywords: keywordRows(results.keywords), paidKeywords: keywordRows(results.paidKeywords),
    pages: rows(results.pages.items).map(item => ({ url: safeUrl(item.page_address), ...metrics(item.metrics) })),
    competitors: rows(results.competitors.items).map(item => ({ domain: text(item.domain), commonKeywords: number(item.intersections), relevance: number(item.relevance), ...metrics(item.full_domain_metrics ?? item.metrics) })).filter(item => item.domain !== plan.target),
    links: rows(results.links.items).map(item => ({ from: safeUrl(item.url_from), to: safeUrl(item.url_to), anchor: text(item.anchor), rank: number(item.rank), dofollow: typeof item.dofollow === "boolean" ? item.dofollow : null, firstSeen: text(item.first_seen), lastSeen: text(item.last_seen) })),
    anchors: rows(results.anchors.items).map(item => ({ anchor: text(item.anchor) || "(empty)", backlinks: number(item.backlinks), referringDomains: number(item.referring_domains) })),
    referring: rows(results.referring.items).map(item => ({ domain: text(item.domain), rank: number(item.rank), backlinks: number(item.backlinks), firstSeen: text(item.first_seen) })),
    ai: { mentions: sum(platforms.map(item => item.mentions)), platforms, sources: rows(row(results.ai.aggregated_metrics).sources_domain).map(item => ({ domain: text(item.key), mentions: number(item.mentions) })) },
    notices: ["Traffic and keyword counts are provider estimates, not your Google Analytics visits. Retrieved time is not the index update time.", "Domain rank uses DataForSEO’s 0–100 backlink scale. It is not SEMrush Authority Score.", "SEO uses the selected country and language; backlinks cover the domain worldwide. Country/language rows overlap and must not be summed as unique keywords.", "History is monthly at the provider’s available depth. Device-specific, branded traffic, SEMrush AI Visibility and market-wide traffic share are not supplied by these endpoints.", "Tables show the highest-ranked sample within the displayed limits; headline totals come from the full provider index."],
  };
}
export type DomainOverview = Awaited<ReturnType<typeof runDomainOverview>>;
