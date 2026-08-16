import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { weekWindowAt } from "@/lib/comms/week";
import type { CommsCadence } from "@/lib/comms/contracts";
import { isWebsiteId } from "@/lib/workspace-selection";

const CADENCES = new Set<CommsCadence>(["essential", "weekly", "guided", "muted"]);

async function scope(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return { supabase, userId: null, website: null };
  const websiteId = new URL(request.url).searchParams.get("site");
  if (!isWebsiteId(websiteId)) return { supabase, userId, website: null };
  const { data: website } = await supabase.from("websites").select("id,organization_id").eq("id", websiteId).maybeSingle();
  return { supabase, userId, website };
}

export async function GET(request: Request) {
  const { supabase, userId, website } = await scope(request);
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  if (!website) return NextResponse.json({ error: "Choose a website to manage its communication cadence." }, { status: 404 });
  const { data, error } = await supabase.from("comms_preferences").select("cadence,user_timezone,email_enabled,push_enabled")
    .eq("website_id", website.id).eq("user_id", userId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preference: data ?? { cadence: "weekly", user_timezone: "UTC", email_enabled: true, push_enabled: false } });
}

export async function PATCH(request: Request) {
  const { supabase, userId, website } = await scope(request);
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  if (!website) return NextResponse.json({ error: "Choose a website to manage its communication cadence." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { cadence?: unknown; userTimezone?: unknown; emailEnabled?: unknown; pushEnabled?: unknown };
  if (typeof body.cadence !== "string" || !CADENCES.has(body.cadence as CommsCadence)) {
    return NextResponse.json({ error: "Choose a valid communication cadence." }, { status: 400 });
  }
  if (typeof body.userTimezone !== "string") return NextResponse.json({ error: "Choose a valid time zone." }, { status: 400 });
  try {
    weekWindowAt(new Date(), body.userTimezone);
  } catch {
    return NextResponse.json({ error: "Choose a valid IANA time zone." }, { status: 400 });
  }
  const { data, error } = await supabase.from("comms_preferences").upsert({
    organization_id: website.organization_id,
    website_id: website.id,
    user_id: userId,
    cadence: body.cadence,
    user_timezone: body.userTimezone,
    email_enabled: typeof body.emailEnabled === "boolean" ? body.emailEnabled : true,
    push_enabled: typeof body.pushEnabled === "boolean" ? body.pushEnabled : false,
  }, { onConflict: "website_id,user_id" }).select("cadence,user_timezone,email_enabled,push_enabled").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preference: data });
}
