import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

  const body = await request.json() as { query?: unknown; mode?: unknown; locationName?: unknown };
  if (typeof body.query !== "string" || (body.mode !== "keyword" && body.mode !== "domain")) {
    return NextResponse.json({ error: "Enter a keyword or domain and select a research mode." }, { status: 400 });
  }

  const { data, error } = await supabase.functions.invoke("seo-research", {
    body: {
      kind: "keywords",
      query: body.query,
      mode: body.mode,
      locationName: typeof body.locationName === "string" ? body.locationName : undefined,
    },
  });

  if (error || !data) {
    const message = (typeof (data as Record<string, unknown> | null)?.error === "string"
      ? (data as Record<string, unknown>).error
      : error?.message) ?? "Destiny could not complete keyword research.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
