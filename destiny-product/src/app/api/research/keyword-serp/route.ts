import { NextResponse } from "next/server";
import { scopedClient } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { websiteId?: unknown; keyword?: unknown; locationName?: unknown };
    const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
    if (!websiteId) return NextResponse.json({ error: "Choose a website before researching this keyword." }, { status: 400 });
    const db = await scopedClient(websiteId);
    if (!await db.getClaims()) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
    const { data: website, error: websiteError } = await db.website("id").maybeSingle();
    if (websiteError || !website) return NextResponse.json({ error: "This website is not available in your workspace." }, { status: 404 });

    const keyword = typeof body.keyword === "string" ? body.keyword.trim().replace(/\s+/g, " ").slice(0, 200) : "";
    if (keyword.length < 2) return NextResponse.json({ error: "Enter a keyword between 2 and 200 characters." }, { status: 400 });
    const locationName = typeof body.locationName === "string" && body.locationName.trim() ? body.locationName.trim() : "United States";
    const { data, error } = await db.invokeFunction<{ error?: string } & Record<string, unknown>>(
      "seo-research",
      { kind: "keyword_serp", keyword, locationName },
    );
    if (error || !data) {
      const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : error?.message || "Rebound SEO could not load live first-page results.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Rebound SEO could not load live first-page results.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
