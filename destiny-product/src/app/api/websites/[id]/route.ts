import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { ACTIVE_WEBSITE_COOKIE, activeWebsiteCookieOptions, isWebsiteId } from "../../../../lib/workspace-selection";

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isWebsiteId(id)) return NextResponse.json({ error: "Choose a valid website." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

  const { data: website, error: lookupError } = await supabase
    .from("websites")
    .select("id,business_name,normalized_domain")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!website) return NextResponse.json({ error: "Website not found." }, { status: 404 });

  const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
  const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim().toLowerCase() : "";
  if (confirmation !== website.normalized_domain.toLowerCase()) {
    return NextResponse.json({ error: `Type ${website.normalized_domain} exactly to delete this website.` }, { status: 400 });
  }

  const { data: deletedWebsite, error: deletionError } = await supabase
    .from("websites")
    .delete()
    .eq("id", id)
    .eq("normalized_domain", website.normalized_domain)
    .select("id")
    .maybeSingle();
  if (deletionError) return NextResponse.json({ error: deletionError.message }, { status: 500 });
  if (!deletedWebsite) {
    return NextResponse.json({ error: "Only the workspace owner can delete this website." }, { status: 403 });
  }

  const { data: remainingWebsites, error: remainingError } = await supabase
    .from("websites")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (remainingError) return NextResponse.json({ error: remainingError.message }, { status: 500 });

  const activeWebsiteId = cookieValue(request, ACTIVE_WEBSITE_COOKIE);
  const remainingIds = (remainingWebsites ?? []).map((entry) => entry.id);
  const nextWebsiteId = activeWebsiteId && activeWebsiteId !== id && remainingIds.includes(activeWebsiteId)
    ? activeWebsiteId
    : remainingIds[0] ?? null;
  const response = NextResponse.json({ deleted: true, nextWebsiteId });
  if (nextWebsiteId) response.cookies.set(ACTIVE_WEBSITE_COOKIE, nextWebsiteId, activeWebsiteCookieOptions);
  else response.cookies.delete(ACTIVE_WEBSITE_COOKIE);
  return response;
}
