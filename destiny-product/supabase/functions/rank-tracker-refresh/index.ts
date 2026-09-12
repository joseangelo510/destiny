import { rankTrackingAccess } from "../_shared/billing/rank-access.ts";
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
    const { data, error } = await context.supabaseAdmin.rpc("billing_rank_candidates");
    if (error) return json({ error: error.message }, 500);
    const due = (data ?? []) as unknown as DueKeyword[];
    const groups = due.reduce<Record<string, DueKeyword[]>>((acc, row) => ({ ...acc, [row.website_id]: [...(acc[row.website_id] ?? []), row] }), {});
    const completedRuns: Array<{ websiteId: string; status: string; completed: number; failed: number; totalCost: number }> = [];

    for (const [websiteId, rows] of Object.entries(groups)) {
      const access = await rankTrackingAccess(context.supabaseAdmin, websiteId);
      if (!access) {
        completedRuns.push({ websiteId, status: "billing_paused", completed: 0, failed: 0, totalCost: 0 });
        continue;
      }
      const eligible: Array<{ row: DueKeyword; id: string; nextCheckAt: string }> = [];
      for (const row of rows) {
        const { data: reservation, error: reserveError } = await context.supabaseAdmin.rpc("reserve_rank_check", { p_target_id: row.id });
        if (reserveError) return json({ error: "Tracking usage could not be reserved." }, 503);
        if (reservation?.allowed && typeof reservation.id === "string" && typeof reservation.nextCheckAt === "string") eligible.push({ row, id: reservation.id, nextCheckAt: reservation.nextCheckAt });
      }
      if (!eligible.length) { completedRuns.push({ websiteId, status: "billing_limited", completed: 0, failed: 0, totalCost: 0 }); continue; }
      const { data: run, error: runError } = await context.supabaseAdmin.from("rank_tracker_runs").insert({ website_id: websiteId, status: "running", requested_count: eligible.length, started_at: now.toISOString() }).select("id").single();
      if (runError || !run?.id) {
        // No provider work started. Preserve receipts and settle known zero expense.
        for (const { id } of eligible) {
          await context.supabaseAdmin.rpc("finish_billing_usage", { p_id: id, p_succeeded: false, p_provider_cost_usd: 0 });
        }
        return json({ error: "Tracking run could not be saved." }, 503);
      }
      let completed = 0;
      let failed = 0;
      let totalCost = 0;
      for (const { row, id: usageId, nextCheckAt } of eligible) {
        let providerCost: number | null = null;
        let succeeded = false;
        try {
          const observation = await fetchRank({ ...row, search_depth: 100 }, login, password);
          providerCost = observation.providerCost;
          totalCost += observation.providerCost;
          const { error: insertError } = await context.supabaseAdmin.from("rank_observations").insert({
            tracked_keyword_id: row.id,
            website_id: row.website_id,
            observed_at: observation.observedAt,
            found: observation.found,
            position: observation.position,
            result_url: observation.resultUrl,
            result_title: observation.resultTitle,
            search_depth: 100,
            provider_task_id: observation.providerTaskId,
            provider_cost: observation.providerCost,
            check_url: observation.checkUrl,
            evidence: observation.evidence,
          });
          if (insertError) throw insertError;
          succeeded = true;
          completed += 1;
          await context.supabaseAdmin.from("tracked_keywords").update({ status: "active", last_checked_at: observation.observedAt, next_check_at: nextCheckAt, last_error: null }).eq("id", row.id);
        } catch (cause) {
          failed += 1;
          const message = cause instanceof Error ? cause.message : "Rank check failed.";
          await context.supabaseAdmin.from("tracked_keywords").update({ status: "error", last_error: message.slice(0, 1000), next_check_at: nextCheckAt }).eq("id", row.id);
        } finally {
          const { error: settleError } = await context.supabaseAdmin.rpc("finish_billing_usage", { p_id: usageId, p_succeeded: succeeded, p_provider_cost_usd: providerCost });
          if (settleError) return json({ error: "Tracking usage confirmation is pending." }, 503);
        }
      }
      const status = failed === 0 ? "complete" : completed === 0 ? "failed" : "partial";
      if (run?.id) await context.supabaseAdmin.from("rank_tracker_runs").update({ status, completed_count: completed, failed_count: failed, provider_cost: totalCost, completed_at: new Date().toISOString() }).eq("id", run.id);
      completedRuns.push({ websiteId, status, completed, failed, totalCost });
    }
    return json({ considered: due.length, processed: completedRuns.reduce((count, run) => count + run.completed + run.failed, 0), runs: completedRuns });
  }),
};
