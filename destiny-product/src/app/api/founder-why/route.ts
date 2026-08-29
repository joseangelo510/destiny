import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as { founderWhy?: unknown };
  if (typeof body.founderWhy !== "string") return NextResponse.json({ error: "Write your why before saving." }, { status: 400 });
  const founderWhy = body.founderWhy.trim();
  if (founderWhy.length > 1000) return NextResponse.json({ error: "Keep your why under 1,000 characters." }, { status: 400 });
  if (founderWhy && founderWhy.length < 12) return NextResponse.json({ error: "Use at least 12 characters, or leave it empty to clear it." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to save your why." }, { status: 401 });

  const { data, error } = await supabase.from("profiles").update({ founder_why: founderWhy }).eq("id", userId).select("founder_why").maybeSingle();
  if (error) return NextResponse.json({ error: "Rebound SEO could not save your why." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Rebound SEO could not find your private profile." }, { status: 404 });
  return NextResponse.json({ founderWhy: data.founder_why });
}
