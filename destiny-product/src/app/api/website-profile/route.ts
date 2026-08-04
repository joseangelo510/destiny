import { NextResponse } from "next/server";
import { isValidBuilderToolSelection, isValidPlatformSelection } from "@/lib/integrations/website-profile";
import { createClient } from "@/lib/supabase/server";

// Saves the "Your website" profile (platform + AI builder tools) onto the
// user's website row. Tenant isolation is enforced by the websites RLS
// policies — an update outside the caller's organization matches zero rows.
export async function POST(request: Request) {
  try {
    const body = await request.json() as { websiteId?: unknown; platform?: unknown; builderTools?: unknown };
    const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
    const platform = body.platform === undefined ? null : body.platform;
    const builderTools = body.builderTools ?? [];
    if (!websiteId || !isValidPlatformSelection(platform) || !isValidBuilderToolSelection(builderTools)) {
      return NextResponse.json({ error: "Choose a platform and AI tools from the provided options." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

    const { data: updated, error } = await supabase
      .from("websites")
      .update({ builder_profile: { platform, builderTools } })
      .eq("id", websiteId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) return NextResponse.json({ error: "Website access denied." }, { status: 404 });

    return NextResponse.json({ saved: true, platform, builderTools });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Destiny could not save your website profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
