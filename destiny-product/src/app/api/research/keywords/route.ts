import { billingFailureResponse } from "@/lib/billing/failure-response";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyResearchWorkerFailure } from "@/lib/seo/research-worker-failure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims?.sub) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

    const body = await request.json() as { query?: unknown; mode?: unknown; locationName?: unknown; metricContractVersion?: unknown };
    if (typeof body.query !== "string" || (body.mode !== "keyword" && body.mode !== "domain")) {
      return NextResponse.json({ error: "Enter a keyword or domain and select a research mode." }, { status: 400 });
    }
    const { data, error } = await supabase.functions.invoke("seo-research", {
      body: {
        kind: "keywords",
        ...(body.metricContractVersion === 2 ? { metricContractVersion: 2 } : {}),
        query: body.query,
        mode: body.mode,
        locationName: typeof body.locationName === "string" ? body.locationName : undefined,
      },
    });
    const billingFailure = await billingFailureResponse(error);
    if (billingFailure) return billingFailure;
    if (error || !data) {
      const failure = await classifyResearchWorkerFailure(error);
      console.error("seo_research_worker_failure", failure.diagnostic);
      return NextResponse.json({ error: failure.message, code: failure.code }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Rebound SEO could not complete keyword research.";
    const status = /configured/i.test(message) ? 503 : /enter a|valid public/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
