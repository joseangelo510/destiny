import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PlanTierId } from "@/lib/plans/weekly-plan";

const tiers = new Set<PlanTierId>(["beginner", "moderate", "super_growth"]);

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as { tier?: unknown; websiteId?: unknown };
  if (typeof body.websiteId !== "string" || typeof body.tier !== "string" || !tiers.has(body.tier as PlanTierId)) {
    return NextResponse.json({ error: "Choose a valid weekly plan." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data, error } = await supabase.from("websites").update({
    plan_tier: body.tier,
    plan_selected_at: new Date().toISOString(),
  }).eq("id", body.websiteId).select("id,plan_tier").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Website not found." }, { status: 404 });
  return NextResponse.json({ website: data });
}
