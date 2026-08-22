import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { websiteScopedClient } from "@/lib/interviews/server";

const statuses = new Set(["confirmed_by_owner", "rejected_by_owner"]);
function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub !== "string") return NextResponse.json({ error: "Sign in again to update the Voice Library." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const itemId = text(body.itemId, 100);
  const status = text(body.status, 40);
  if (!itemId || !statuses.has(status)) return NextResponse.json({ error: "Choose a valid Voice Library decision." }, { status: 400 });
  const db = websiteScopedClient(supabase);
  const { data, error } = await db.from("voice_library_items").update({ status }).eq("id", itemId).eq("interview_id", id).select("id,status").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "That insight is not available in this interview." }, { status: 404 });
  return NextResponse.json({ item: data });
}
