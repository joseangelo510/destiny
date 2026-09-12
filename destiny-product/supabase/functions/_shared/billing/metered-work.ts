import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
import type { Meter } from "./plans.ts";
type MeteredInput = { ownerId: string; websiteId?: string; meter: Meter; requestKey: string; units?: number };
const json = (error: string, code: string, status: number) => Response.json({ error, code, billingUrl: "/account/billing" }, { status, headers: { "Cache-Control": "private, no-store" } });
/** Trusted worker boundary; never expose settlement to a browser-controlled action. */
export async function meteredResponse(admin: SupabaseClient, input: MeteredInput, run: () => Promise<Response>, providerCost: () => number | null = () => null): Promise<Response> {
  const { data, error } = await admin.rpc("reserve_billing_usage", {
    p_owner_id: input.ownerId, p_website_id: input.websiteId ?? null, p_request_key: input.requestKey,
    p_meter: input.meter, p_units: input.units ?? 1,
  });
  if (error || !data) return json("Your usage could not be checked. Please try again shortly.", "BILLING_UNAVAILABLE", 503);
  if (!data.allowed) {
    if (data.reason === "duplicate") return json("This request has already started. Check your saved results before trying again.", "BILLING_DUPLICATE", 409);
    if (data.reason === "limit_reached") return json("You've used this plan's allowance. Upgrade your plan or wait for your next billing period.", "BILLING_LIMIT_REACHED", 402);
    return json("Choose a plan or update your payment to continue. Your saved work is still available.", "BILLING_PAYMENT_REQUIRED", 402);
  }
  if (typeof data.id !== "string") return json("Your usage could not be reserved.", "BILLING_UNAVAILABLE", 503);
  let response: Response;
  try { response = await run(); }
  catch { response = json("The research provider could not complete this request. Please try again shortly.", "PROVIDER_UNAVAILABLE", 502); }
  const cost = providerCost();
  const { error: finishError } = await admin.rpc("finish_billing_usage", {
    p_id: data.id, p_succeeded: response.ok,
    p_provider_cost_usd: typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : null,
  });
  // Keep the reservation consumed if persistence is unavailable; never silently grant extra work.
  if (finishError) return json("Usage confirmation is pending. Please wait before starting this request again.", "BILLING_SETTLEMENT_PENDING", 503);
  return response;
}
