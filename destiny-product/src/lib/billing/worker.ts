import "server-only";
import type { BillingWorkerClient } from "@/lib/db/billing";
import { signWorkerRequest } from "../../../supabase/functions/_shared/billing/worker-auth";
export async function invokeBillingWorker(client: BillingWorkerClient, endpoint: "billing-usage" | "seo-research", payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const headers = await signWorkerRequest(body, endpoint, process.env.BILLING_WORKER_SECRET ?? "");
  return client.functions.invoke(endpoint, { body, headers: { ...headers, "Content-Type": "application/json" } });
}
export async function reserveContentWork(client: BillingWorkerClient, websiteId: string, meter: "articles" | "shortOutputs" | "infographics" | "audits", requestKey: string): Promise<{ id: string; response?: never } | { id?: never; response: Response }> {
  const denied = (error: string, code: string, status: number) => ({ response: Response.json({ error, code, billingUrl: "/account/billing" }, { status }) });
  try {
    const { data, error } = await invokeBillingWorker(client, "billing-usage", { action: "reserve", websiteId, meter, requestKey });
    if (error || !data) return denied("Usage could not be checked. Please try again shortly.", "BILLING_UNAVAILABLE", 503);
    if (data.allowed && typeof data.id === "string") return { id: data.id };
    if (data.reason === "duplicate") return denied("This request has already started. Check your saved work before trying again.", "BILLING_DUPLICATE", 409);
    if (data.reason === "limit_reached") return denied("You've used this plan's allowance. Upgrade your plan or wait for the next billing period.", "BILLING_LIMIT_REACHED", 402);
    return denied("Choose a plan or update your payment to continue. Your saved work is still available.", "BILLING_PAYMENT_REQUIRED", 402);
  } catch { return denied("Usage could not be checked. Please try again shortly.", "BILLING_UNAVAILABLE", 503); }
}
export async function finishContentWork(client: BillingWorkerClient, id: string, succeeded: boolean): Promise<boolean> {
  try {
    const { data, error } = await invokeBillingWorker(client, "billing-usage", { action: "finish", id, succeeded });
    return !error && data?.saved === true;
  } catch { return false; }
}
