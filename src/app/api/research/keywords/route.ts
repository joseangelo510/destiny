import { NextResponse } from "next/server";
import { getResearchClient } from "@/lib/seo/research";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims?.sub) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

    const body = await request.json() as { query?: unknown; mode?: unknown; locationName?: unknown };
    if (typeof body.query !== "string" || (body.mode !== "keyword" && body.mode !== "domain")) {
      return NextResponse.json({ error: "Enter a keyword or domain and select a research mode." }, { status: 400 });
    }
    const result = await getResearchClient().keywordResearch({
      query: body.query,
      mode: body.mode,
      locationName: typeof body.locationName === "string" ? body.locationName : undefined,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Destiny could not complete keyword research.";
    const status = /configured/i.test(message) ? 503 : /enter a|valid public/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
