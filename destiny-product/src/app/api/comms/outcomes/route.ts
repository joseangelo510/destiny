import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isWebsiteId } from "@/lib/workspace-selection";
import type { Json } from "@/lib/supabase/database.types";
import { isCommsBetaEnabled } from "@/lib/comms/feature";

const OUTCOMES = new Set(["downstream_completion", "dismiss", "mute", "opt_out", "freeze_used", "recovery_used"]);

export async function POST(request: Request) {
  if (!isCommsBetaEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { websiteId?: unknown; eventId?: unknown; messageId?: unknown; outcome?: unknown; metadata?: unknown };
  if (!isWebsiteId(body.websiteId)) return NextResponse.json({ error: "Choose a valid website." }, { status: 400 });
  if (typeof body.messageId !== "string" || !body.messageId.trim() || body.messageId.length > 300) return NextResponse.json({ error: "A valid message id is required." }, { status: 400 });
  if (typeof body.outcome !== "string" || !OUTCOMES.has(body.outcome)) return NextResponse.json({ error: "Choose a valid message outcome." }, { status: 400 });
  const { data: website } = await supabase.from("websites").select("id,organization_id").eq("id", body.websiteId).maybeSingle();
  if (!website) return NextResponse.json({ error: "That website is not available in this account." }, { status: 404 });
  const metadata = (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {}) as Json;
  const { error } = await supabase.from("comms_message_outcomes").insert({
    organization_id: website.organization_id,
    website_id: website.id,
    user_id: userId,
    event_id: typeof body.eventId === "string" ? body.eventId : null,
    message_id: body.messageId.trim(),
    outcome: body.outcome,
    metadata,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recorded: true }, { status: 201 });
}
