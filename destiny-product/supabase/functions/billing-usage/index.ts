import { callerWebsiteOwner, matchingWebsiteUsage } from "../_shared/billing/caller-website.ts";
import { withSupabase } from "@supabase/server";
import { verifyWorkerRequest } from "../_shared/billing/worker-auth.ts";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const viewerId = context.userClaims?.id;
    if (!viewerId) return json({ error: "Sign in again to continue." }, 401);
    const raw = await request.text();
    if (!await verifyWorkerRequest(raw, "billing-usage", request.headers, Deno.env.get("BILLING_WORKER_SECRET") ?? "")) return json({ error: "Worker authorization required." }, 403);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);
    if (!["reserve", "finish", "bind", "stage"].includes(String(body.action))) return json({ error: "Invalid usage action." }, 400);
    if (typeof body.websiteId !== "string" || !body.websiteId) return json({ error: "Website scope is required." }, 400);
    const ownerId = await callerWebsiteOwner(context.supabase, body.websiteId);
    if (!ownerId) return json({ error: "Website access is unavailable." }, 403);
    if (body.action === "reserve") {
      if (!["articles", "shortOutputs", "infographics", "audits"].includes(String(body.meter)) || typeof body.websiteId !== "string" || typeof body.requestKey !== "string") return json({ error: "Invalid usage request." }, 400);
      const { data, error } = await context.supabaseAdmin.rpc("reserve_billing_usage", { p_owner_id: ownerId, p_website_id: body.websiteId, p_meter: body.meter, p_request_key: body.requestKey, p_units: 1 });
      return error ? json({ error: "Usage reservation unavailable." }, 503) : json(data);
    }
    if (body.action === "bind" || body.action === "stage") {
      if (typeof body.id !== "string" || typeof body.websiteId !== "string" || typeof body.hash !== "string" || !/^[a-f0-9]{64}$/.test(body.hash)) return json({ error: "Invalid artifact request." }, 400);
      if (!await matchingWebsiteUsage(context.supabaseAdmin, ownerId, body.websiteId, body.id, "infographics")) return json({ error: "Artifact reservation unavailable." }, 403);
      if (body.action === "bind") {
        const { error } = await context.supabaseAdmin.rpc("bind_billing_artifact", { p_owner_id: ownerId, p_id: body.id, p_hash: body.hash });
        return error ? json({ error: "Artifact reservation unavailable." }, 409) : json({ saved: true });
      }
      const { data, error } = await context.supabaseAdmin.rpc("claim_billing_stage", { p_owner_id: ownerId, p_id: body.id, p_stage: "infographic_render", p_artifact_hash: body.hash });
      return error || data !== true ? json({ error: "This visual request has already been used or expired. Research the infographic again to create another visual." }, 409) : json({ allowed: true });
    }
    if (body.action === "finish") {
      if (typeof body.id !== "string" || typeof body.succeeded !== "boolean") return json({ error: "Invalid usage outcome." }, 400);
      if (!await matchingWebsiteUsage(context.supabaseAdmin, ownerId, body.websiteId, body.id)) return json({ error: "Usage record unavailable." }, 403);
      const cost = body.providerCost;
      if (cost != null && !(typeof cost === "number" && Number.isFinite(cost) && cost >= 0)) return json({ error: "Invalid usage cost." }, 400);
      const { error } = await context.supabaseAdmin.rpc("finish_billing_usage", { p_id: body.id, p_succeeded: body.succeeded, p_provider_cost_usd: cost ?? null });
      return error ? json({ error: "Usage confirmation unavailable." }, 503) : json({ saved: true });
    }
    return json({ error: "Invalid usage action." }, 400);
  }),
};
