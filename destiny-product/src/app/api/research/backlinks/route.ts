import { billingFailureResponse } from "@/lib/billing/failure-response";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeDomain } from "../../../../../supabase/functions/seo-research/logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims?.sub) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

    const body = await request.json() as { target?: unknown };
    let target: string;
    try {
      if (typeof body.target !== "string") throw new Error("Invalid target");
      target = normalizeDomain(body.target);
    } catch { return NextResponse.json({ error: "Enter a valid public domain." }, { status: 400 }); }
    const { data, error } = await supabase.functions.invoke("seo-research", { body: { kind: "backlinks", target } });
    const billingFailure = await billingFailureResponse(error);
    if (billingFailure) return billingFailure;
    if (error || !data) {
      const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : error?.message || "Rebound SEO could not complete backlink research.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Rebound SEO could not complete backlink research.";
    const status = /configured/i.test(message) ? 503 : /valid public/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
