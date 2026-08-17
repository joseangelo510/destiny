import { withSupabase } from "@supabase/server";
import { parseRankObservation } from "./logic.ts";

type DueKeyword = {
  id: string;
  website_id: string;
  keyword: string;
  location_code: number;
  language_code: string;
  device: string;
  search_depth: number;
  websites: { normalized_domain: string } | { normalized_domain: string }[];
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function authorization(login: string, password: string) {
  const bytes = new TextEncoder().encode(`${login}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

function websiteDomain(row: DueKeyword) {
  const website = Array.isArray(row.websites) ? row.websites[0] : row.websites;
  return website?.normalized_domain ?? "";
}

async function fetchRank(row: DueKeyword, login: string, password: string) {
  const response = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { Authorization: authorization(login, password), "Content-Type": "application/json" },
    body: JSON.stringify([{
      keyword: row.keyword,
      location_code: row.location_code,
      language_code: row.language_code,
      device: row.device,
      depth: row.search_depth,
      remove_from_url: ["srsltid"],
    }]),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`DataForSEO returned HTTP ${response.status}.`);
  return parseRankObservation(await response.json(), websiteDomain(row));
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const expectedSecret = Deno.env.get("RANK_TRACKER_CRON_SECRET")?.trim();
    if (!expectedSecret || request.headers.get("x-rank-tracker-secret") !== expectedSecret) return json({ error: "Unauthorized." }, 401);
    const login = Deno.env.get("DATAFORSEO_LOGIN")?.trim();
    const password = Deno.env.get("DATAFORSEO_PASSWORD")?.trim();
    if (!login || !password) return json({ error: "DataForSEO is not configured." }, 503);

    const now = new Date();
    const { data, error } = await context.supabaseAdmin.from("tracked_keywords")
      .select("id,website_id,keyword,location_code,language_code,device,search_depth,websites!inner(normalized_domain)")
      .in("status", ["pending", "active", "error"])
      .lte("next_check_at", now.toISOString())
      .order("next_check_at")
      .limit(100);
    if (error) return json({ error: error.message }, 500);
    const due = (data ?? []) as unknown as DueKeyword[];
    const groups = due.reduce<Record<string, DueKeyword[]>>((acc, row) => ({ ...acc, [row.website_id]: [...(acc[row.website_id] ?? []), row] }), {});
    const websiteIds = Object.keys(groups);
    const { data: preferences } = websiteIds.length
      ? await context.supabaseAdmin.from("notification_preferences").select("website_id,ranking_digest_frequency").in("website_id", websiteIds)
      : { data: [] };
    const cadenceByWebsite = new Map((preferences ?? []).map((preference) => [preference.website_id, preference.ranking_digest_frequency]));
    const completedRuns: unknown[] = [];

    for (const [websiteId, rows] of Object.entries(groups)) {
      const refreshDays = cadenceByWebsite.get(websiteId) === "three_day" ? 3 : 7;
      const { data: run } = await context.supabaseAdmin.from("rank_tracker_runs").insert({ website_id: websiteId, status: "running", requested_count: rows.length, started_at: now.toISOString() }).select("id").single();
      let completed = 0;
      let failed = 0;
      let totalCost = 0;
      for (const row of rows) {
        try {
          const observation = await fetchRank(row, login, password);
          const { error: insertError } = await context.supabaseAdmin.from("rank_observations").insert({
            tracked_keyword_id: row.id,
            website_id: row.website_id,
            observed_at: observation.observedAt,
            found: observation.found,
            position: observation.position,
            result_url: observation.resultUrl,
            result_title: observation.resultTitle,
            search_depth: row.search_depth,
            provider_task_id: observation.providerTaskId,
            provider_cost: observation.providerCost,
            check_url: observation.checkUrl,
            evidence: observation.evidence,
          });
          if (insertError) throw insertError;
          totalCost += observation.providerCost;
          completed += 1;
          await context.supabaseAdmin.from("tracked_keywords").update({ status: "active", last_checked_at: observation.observedAt, next_check_at: new Date(now.getTime() + refreshDays * 86_400_000).toISOString(), last_error: null }).eq("id", row.id);
        } catch (cause) {
          failed += 1;
          const message = cause instanceof Error ? cause.message : "Rank check failed.";
          await context.supabaseAdmin.from("tracked_keywords").update({ status: "error", last_error: message.slice(0, 1000), next_check_at: new Date(now.getTime() + 86_400_000).toISOString() }).eq("id", row.id);
        }
      }
      const status = failed === 0 ? "complete" : completed === 0 ? "failed" : "partial";
      if (run?.id) await context.supabaseAdmin.from("rank_tracker_runs").update({ status, completed_count: completed, failed_count: failed, provider_cost: totalCost, completed_at: new Date().toISOString() }).eq("id", run.id);
      completedRuns.push({ websiteId, status, completed, failed, totalCost });
    }
    return json({ processed: due.length, runs: completedRuns });
  }),
};
