import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { websiteId?: unknown; locationName?: unknown };
    if (typeof body.websiteId !== "string" || !body.websiteId) {
      return NextResponse.json({ error: "Complete onboarding before starting an audit." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
    }

    const { data: accessibleWebsite, error: accessError } = await supabase
      .from("websites")
      .select("id")
      .eq("id", body.websiteId)
      .maybeSingle();
    if (accessError || !accessibleWebsite) {
      return NextResponse.json({ error: "You do not have access to that website." }, { status: 403 });
    }

    const { data, error } = await supabase.functions.invoke<{ auditId?: string; error?: string; progress?: number; resultsPath?: string; status?: string }>("process-audit", {
      body: {
        websiteId: body.websiteId,
        locationName: typeof body.locationName === "string" ? body.locationName : undefined,
      },
    });
    if (error || !data) {
      const message = data && "error" in data && typeof data.error === "string"
        ? data.error
        : error?.message || "Destiny could not run the audit.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json(data, { status: 202 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Destiny could not run the audit.";
    const status = message.includes("valid public website") || message.includes("too long") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
