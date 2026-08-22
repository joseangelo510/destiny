import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { interlinkStatusTransition, type InterlinkAction, type InterlinkStatus } from "@/lib/seo/interlinking";

const actions = new Set<InterlinkAction>(["approve", "skip", "mark_done"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { action?: unknown; reason?: unknown };
  const action = typeof body.action === "string" && actions.has(body.action as InterlinkAction) ? body.action as InterlinkAction : null;
  if (!action) return NextResponse.json({ error: "Choose a valid internal-link action." }, { status: 400 });
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub !== "string") return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;
  const { data: opportunity } = await db.from("interlink_opportunities").select("id,status").eq("id", id).maybeSingle();
  if (!opportunity) return NextResponse.json({ error: "Internal-link opportunity not found." }, { status: 404 });
  const nextStatus = interlinkStatusTransition(opportunity.status as InterlinkStatus, action);
  if (!nextStatus) return NextResponse.json({ error: `This link is already ${opportunity.status.replaceAll("_", " ")}. Refresh the page before changing it.` }, { status: 409 });
  const updates = {
    status: nextStatus,
    skip_reason: action === "skip" && typeof body.reason === "string" ? body.reason.trim().slice(0, 500) || null : null,
    ...(action === "approve" ? { verified_at: null, verified_anchor: null } : {}),
  };
  const { error } = await db.from("interlink_opportunities").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: nextStatus });
}
