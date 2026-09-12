import { withSupabase } from "@supabase/server";
import { parseCompetitorSuggestions } from "./logic.ts";

type SuggestionRequest = {
  website?: unknown;
  locationName?: unknown;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function normalizeDomain(value: string) {
  const withProtocol = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = new URL(withProtocol);
  const domain = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!domain || !domain.includes(".") || domain === "localhost") throw new Error("Enter a valid public website.");
  return domain;
}

function authorization(login: string, password: string) {
  const bytes = new TextEncoder().encode(`${login}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const ownerId = context.userClaims?.id;
    if (!ownerId) return json({ error: "Sign in again to continue." }, 401);
    let body: SuggestionRequest;
    try {
      body = await request.json() as SuggestionRequest;
    } catch {
      return json({ error: "Request body must be valid JSON." }, 400);
    }
    if (typeof body.website !== "string") return json({ error: "Enter a valid public website." }, 400);

    let target: string;
    try {
      target = normalizeDomain(body.website);
    } catch (cause) {
      return json({ error: cause instanceof Error ? cause.message : "Enter a valid public website." }, 400);
    }
    const login = Deno.env.get("DATAFORSEO_LOGIN")?.trim();
    const password = Deno.env.get("DATAFORSEO_PASSWORD")?.trim();
    if (!login || !password) return json({ suggestions: [], provider: "unavailable" });

    const mode = Deno.env.get("BILLING_MODE");
    if (mode !== "test" && mode !== "live") return json({ error: "Research billing setup is not complete." }, 503);
    const { data: reservation, error } = await context.supabaseAdmin.rpc("reserve_competitor_suggestions", { p_owner_id: ownerId, p_livemode: mode === "live" });
    if (error || !reservation) return json({ error: "Research usage could not be checked." }, 503);
    if (!reservation.allowed) {
      const verification = reservation.reason === "verification_required";
      const limited = reservation.reason === "limit_reached";
      return json({ suggestions: [], error: "Automatic discovery is unavailable. You can still enter competitors you know.",
        code: verification ? "BILLING_VERIFICATION_REQUIRED" : limited ? "BILLING_LIMIT_REACHED" : "BILLING_PAYMENT_REQUIRED",
        billingUrl: "/account/billing" }, verification ? 403 : 402);
    }
    if (typeof reservation.id !== "string") return json({ error: "Research usage could not be reserved." }, 503);
    let succeeded = false;
    let providerCost: number | null = null;
    let output: Response;
    try {
      const response = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live", {
        method: "POST",
        headers: { Authorization: authorization(login, password), "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify([{
          target,
          location_name: typeof body.locationName === "string" && body.locationName.trim() ? body.locationName.trim() : "United States",
          language_name: "English",
          item_types: ["organic", "local_pack"],
          exclude_top_domains: true,
          order_by: ["intersections,desc"],
          limit: 10,
        }]),
      });
      if (!response.ok) throw new Error("Competitor research unavailable.");
      const payload = await response.json();
      const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
      const costs = tasks.map((task: { cost?: unknown }) => task.cost);
      if (costs.length && costs.every((cost: unknown) => typeof cost === "number" && Number.isFinite(cost) && cost >= 0)) providerCost = costs.reduce((sum: number, cost: number) => sum + cost, 0);
      if (payload?.status_code !== 20000 || tasks[0]?.status_code !== 20000) throw new Error("Competitor research unavailable.");
      succeeded = true;
      output = json({ suggestions: parseCompetitorSuggestions(payload, target), provider: "dataforseo" });
    } catch {
      output = json({ suggestions: [], provider: "failed", warning: "Automatic discovery is unavailable. You can still enter competitors you know." });
    }
    const { error: settlementError } = await context.supabaseAdmin.rpc("finish_billing_usage", { p_id: reservation.id, p_succeeded: succeeded, p_provider_cost_usd: providerCost });
    if (settlementError) return json({ error: "Research usage confirmation is pending." }, 503);
    return output;

  }),
};
