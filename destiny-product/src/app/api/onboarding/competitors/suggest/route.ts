import { NextResponse } from "next/server";
import { normalizeWebsite } from "@/lib/seo/url";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { website?: unknown; locationName?: unknown };
    if (typeof body.website !== "string") {
      return NextResponse.json({ error: "Enter a valid public website." }, { status: 400 });
    }
    const website = normalizeWebsite(body.website);
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Rebound SEO could not start competitor discovery." }, { status: 401 });
    }
    const { data, error } = await supabase.functions.invoke<{
      suggestions?: Array<{ domain: string; sharedKeywords: number; relation: "search_landscape" }>;
      error?: string;
    }>("suggest-competitors", {
      body: {
        website: website.url,
        locationName: typeof body.locationName === "string" ? body.locationName : "United States",
      },
    });
    if (error) return NextResponse.json({ suggestions: [], warning: error.message });
    return NextResponse.json({ suggestions: data?.suggestions ?? [] });
  } catch (cause) {
    return NextResponse.json({
      suggestions: [],
      warning: cause instanceof Error ? cause.message : "Competitor discovery is unavailable.",
    });
  }
}
