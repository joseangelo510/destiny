import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { status?: unknown };
  if (body.status !== "complete" && body.status !== "todo" && body.status !== "skipped") {
    return NextResponse.json({ error: "Choose a valid quest status." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const { data: quest, error } = await supabase.from("quests").update({
    status: body.status,
    completed_at: body.status === "complete" ? new Date().toISOString() : null,
  }).eq("id", id).select("id,status,completed_at,xp").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!quest) return NextResponse.json({ error: "Quest not found." }, { status: 404 });
  return NextResponse.json({ quest });
}
