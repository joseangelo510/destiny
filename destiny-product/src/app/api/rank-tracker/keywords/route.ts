import { NextResponse } from "next/server";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";
import { createClient } from "@/lib/supabase/server";

function responseKeyword(row: {
  id: string; keyword: string; list_id: string | null; status: string; source: string;
  created_at: string; last_checked_at: string | null;
}) {
  return {
    id: row.id,
    keyword: row.keyword,
    listId: row.list_id,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    lastCheckedAt: row.last_checked_at,
    currentPosition: null,
    previousPosition: null,
    found: null,
    resultUrl: null,
    checkedAt: null,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { websiteId?: unknown; keyword?: unknown; listId?: unknown; source?: unknown };
  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  const keyword = typeof body.keyword === "string" ? body.keyword.trim().replace(/\s+/g, " ").slice(0, 500) : "";
  const listId = typeof body.listId === "string" && body.listId ? body.listId : null;
  const source = body.source === "strategy" || body.source === "research" ? body.source : "manual";
  if (!websiteId || !keyword) return NextResponse.json({ error: "Choose a website and enter a keyword." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

  const { data: website } = await supabase.from("websites").select("id").eq("id", websiteId).maybeSingle();
  if (!website) return NextResponse.json({ error: "Website not found." }, { status: 404 });
  if (listId) {
    const { data: list } = await supabase.from("rank_tracker_lists").select("id").eq("id", listId).eq("website_id", websiteId).maybeSingle();
    if (!list) return NextResponse.json({ error: "Keyword list not found." }, { status: 404 });
  }

  const normalizedKeyword = normalizeTrackedKeyword(keyword);
  const { data: existing } = await supabase.from("tracked_keywords")
    .select("id,keyword,list_id,status,source,created_at,last_checked_at")
    .eq("website_id", websiteId).eq("normalized_keyword", normalizedKeyword)
    .eq("location_code", 2840).eq("language_code", "en").eq("device", "desktop").maybeSingle();
  if (existing) {
    const { data, error } = await supabase.from("tracked_keywords")
      .update({ list_id: listId ?? existing.list_id, status: existing.status === "paused" ? "pending" : existing.status, next_check_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id,keyword,list_id,status,source,created_at,last_checked_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ keyword: responseKeyword(data), alreadyTracked: true });
  }

  const { data, error } = await supabase.from("tracked_keywords").insert({
    website_id: websiteId,
    list_id: listId,
    created_by: userId,
    keyword,
    normalized_keyword: normalizedKeyword,
    source,
  }).select("id,keyword,list_id,status,source,created_at,last_checked_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keyword: responseKeyword(data), alreadyTracked: false });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as { id?: unknown; listId?: unknown; status?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const listId = typeof body.listId === "string" && body.listId ? body.listId : null;
  const status = body.status === "active" || body.status === "paused" || body.status === "pending" ? body.status : undefined;
  if (!id) return NextResponse.json({ error: "Tracked keyword not found." }, { status: 400 });
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data: current } = await supabase.from("tracked_keywords").select("id,website_id").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Tracked keyword not found." }, { status: 404 });
  if (listId) {
    const { data: list } = await supabase.from("rank_tracker_lists").select("id").eq("id", listId).eq("website_id", current.website_id).maybeSingle();
    if (!list) return NextResponse.json({ error: "Keyword list not found." }, { status: 404 });
  }
  const updates: { list_id: string | null; status?: string; next_check_at?: string } = { list_id: listId };
  if (status) updates.status = status;
  if (status === "pending") updates.next_check_at = new Date().toISOString();
  const { error } = await supabase.from("tracked_keywords").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
