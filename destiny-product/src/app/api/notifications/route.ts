import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notificationTitleForWebsite } from "@/lib/product/notifications";
import { isWebsiteId, siteScopedHref } from "@/lib/workspace-selection";

async function requestedWebsite(request: Request, supabase: Awaited<ReturnType<typeof createClient>>) {
  const websiteId = new URL(request.url).searchParams.get("site");
  if (!isWebsiteId(websiteId)) return { error: "Choose a website to view its notifications.", website: null };
  const { data: website, error } = await supabase
    .from("websites")
    .select("id,business_name,normalized_domain")
    .eq("id", websiteId)
    .maybeSingle();
  if (error || !website) return { error: "That website is not available in this account.", website: null };
  return { error: null, website };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const selected = await requestedWebsite(request, supabase);
  if (!selected.website) return NextResponse.json({ error: selected.error }, { status: 404 });

  const { data, error } = await supabase
    .from("notifications")
    .select("id,kind,title,body,destination_path,read_at,created_at,website_id")
    .eq("website_id", selected.website.id)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const websiteName = selected.website.business_name?.trim() || selected.website.normalized_domain;
  return NextResponse.json({ notifications: (data ?? []).map((notification) => ({
    ...notification,
    title: notificationTitleForWebsite(notification.title, websiteName),
    website_name: websiteName,
    destination_path: notification.destination_path
      ? siteScopedHref(notification.destination_path, selected.website.id)
      : null,
  })) });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const selected = await requestedWebsite(request, supabase);
  if (!selected.website) return NextResponse.json({ error: selected.error }, { status: 404 });

  const body = await request.json() as { id?: unknown; all?: unknown };
  const query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("website_id", selected.website.id);
  const { error } = body.all === true
    ? await query.is("read_at", null)
    : typeof body.id === "string"
      ? await query.eq("id", body.id)
      : { error: new Error("Choose a notification to mark as read.") };

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
