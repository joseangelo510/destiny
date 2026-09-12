import { withSupabase } from "@supabase/server";
import { verifyWorkerRequest } from "../_shared/billing/worker-auth.ts";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const ownerId = context.userClaims?.id;
    if (!ownerId) return json({ error: "Sign in again to continue." }, 401);
    const raw = await request.text();
    if (!await verifyWorkerRequest(raw, "billing-usage", request.headers, Deno.env.get("BILLING_WORKER_SECRET") ?? "")) return json({ error: "Worker authorization required." }, 403);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);
    if (body.action === "reserve") {
      if (!["articles", "shortOutputs", "infographics", "audits"].includes(String(body.meter)) || typeof body.websiteId !== "string" || typeof body.requestKey !== "string") return json({ error: "Invalid usage request." }, 400);
      const { data, error } = await context.supabaseAdmin.rpc("reserve_billing_usage", { p_owner_id: ownerId, p_website_id: body.websiteId, p_meter: body.meter, p_request_key: body.requestKey, p_units: 1 });
      return error ? json({ error: "Usage reservation unavailable." }, 503) : json(data);
    }
    if (body.action === "finish") {
      if (typeof body.id !== "string" || typeof body.succeeded !== "boolean") return json({ error: "Invalid usage outcome." }, 400);
      const { data: usage, error: readError } = await context.supabaseAdmin.from("billing_usage").select("id").eq("id", body.id).eq("owner_id", ownerId).maybeSingle();
      if (readError) return json({ error: "Usage confirmation unavailable." }, 503);
      if (!usage) return json({ error: "Usage record unavailable." }, 404);
      const cost = body.providerCost;
      if (cost != null && !(typeof cost === "number" && Number.isFinite(cost) && cost >= 0)) return json({ error: "Invalid usage cost." }, 400);
      const { error } = await context.supabaseAdmin.rpc("finish_billing_usage", { p_id: usage.id, p_succeeded: body.succeeded, p_provider_cost_usd: cost ?? null });
      return error ? json({ error: "Usage confirmation unavailable." }, 503) : json({ saved: true });
    }
    return json({ error: "Invalid usage action." }, 400);
  }),
};
