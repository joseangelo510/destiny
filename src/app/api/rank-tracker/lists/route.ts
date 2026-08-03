import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { websiteId?: unknown; name?: unknown };
  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  if (!websiteId || !name) return NextResponse.json({ error: "Enter a list name." }, { status: 400 });
  if (name.toLocaleLowerCase("en-US") === "general") return NextResponse.json({ error: "General is already your default list." }, { status: 409 });
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data: website } = await supabase.from("websites").select("id").eq("id", websiteId).maybeSingle();
  if (!website) return NextResponse.json({ error: "Website not found." }, { status: 404 });
  const { data, error } = await supabase.from("rank_tracker_lists").insert({ website_id: websiteId, created_by: userId, name }).select("id,name").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A list with this name already exists." : error.message }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ list: data });
}
