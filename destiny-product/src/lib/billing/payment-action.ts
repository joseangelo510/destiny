import { NextResponse } from "next/server";
import { planById } from "./plans";
import { billingSessionClient } from "@/lib/db/billing";
export function billingOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production") return origin === "https://app.reboundseo.com" ? origin : null;
  if (!["127.0.0.1", "localhost"].includes(requestUrl.hostname)) return origin === "https://app.reboundseo.com" ? origin : null;
  try {
    const caller = new URL(origin ?? "");
    return caller.origin === origin && ["127.0.0.1", "localhost"].includes(caller.hostname)
      && caller.protocol === requestUrl.protocol && caller.port === requestUrl.port ? origin : null;
  } catch { return null; }
}
export function hostedPaymentUrl(value: unknown, action: "checkout" | "portal") {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const host = action === "checkout" ? "checkout.stripe.com" : "billing.stripe.com";
    const allowedPath = action === "checkout" ? ["/c/pay/", "/g/pay/"].some(path => url.pathname.startsWith(path)) : url.pathname.startsWith("/p/session/") || url.pathname === "/p/session";
    return url.protocol === "https:" && url.host === host && !url.username && !url.password && allowedPath ? url.href : null;
  } catch { return null; }
}
export async function runPaymentAction(request: Request, action: "checkout" | "portal", session: Awaited<ReturnType<typeof billingSessionClient>>, origin: string) {
  let plan;
  if (action === "checkout") {
    try { plan = planById((await request.formData()).get("plan")); }
    catch { return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 }); }
    if (!plan) return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 });
  }
  try {
    const { data, error } = await session.invoke({ action, ...(plan ? { plan: plan.id } : {}) });
    const url = !error && hostedPaymentUrl(data?.url, action);
    if (url) return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "private, no-store" } });
  } catch { /* Preserve a safe recovery path; never display provider secrets. */ }
  return NextResponse.redirect(`${origin}/account/billing?billing_error=unavailable`, { status: 303, headers: { "Cache-Control": "private, no-store" } });
}
