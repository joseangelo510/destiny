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

    const body = await request.json() as { target?: unknown };
    if (typeof body.target !== "string") return NextResponse.json({ error: "Enter a public domain." }, { status: 400 });
    const result = await getResearchClient().backlinkResearch({ target: body.target });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Destiny could not complete backlink research.";
    const status = /configured/i.test(message) ? 503 : /valid public/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
