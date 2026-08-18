import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildWeeklySchedule, unapprovedCalendarKeywords, validatePublishingPlan, type PublishingMode } from "@/lib/content/publishing-plan";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CalendarInput = { keyword?: unknown; title?: unknown; contentType?: unknown };

function validId(value: unknown) {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function normalizedKeyword(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function calendarInput(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((entry, index) => {
    const item = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as CalendarInput : {};
    const keyword = typeof item.keyword === "string" ? item.keyword.trim().slice(0, 300) : "";
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 500) : "";
    const contentType = typeof item.contentType === "string" ? item.contentType.trim().slice(0, 100) : "";
    return keyword && title && contentType ? [{ position: index + 1, keyword, title, contentType }] : [];
  });
}

async function auth() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: typeof data?.claims?.sub === "string" ? data.claims.sub : null };
}

export async function GET(request: Request) {
  const websiteId = validId(new URL(request.url).searchParams.get("websiteId"));
  if (!websiteId) return NextResponse.json({ error: "Choose a valid website." }, { status: 400 });
  const { supabase, userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in again to load the publishing plan." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;
  const { data: plan, error } = await db.from("publishing_plans").select("id,mode,status,timezone,holdback_hours,start_date,end_date,confirmed_post_count,automatic_confirmed_at").eq("website_id", websiteId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Destiny could not load the publishing plan." }, { status: 500 });
  const { data: items } = plan ? await db.from("publishing_schedule_items").select("id,plan_id,position,keyword,title,content_type,scheduled_for,state,review_recommended,remote_edit_url,remote_permalink,last_error").eq("plan_id", plan.id).order("position") : { data: [] };
  return NextResponse.json({ plan, items: items ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const { supabase, userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in again to save the publishing plan." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const websiteId = validId(body.websiteId);
  const auditId = validId(body.auditId);
  const calendar = calendarInput(body.calendar);
  if (!websiteId || !auditId || !calendar.length) return NextResponse.json({ error: "The website, audit, or editorial calendar is incomplete." }, { status: 400 });

  let input;
  try {
    input = validatePublishingPlan({
      mode: body.mode as PublishingMode,
      startDate: typeof body.startDate === "string" ? body.startDate : "",
      timezone: typeof body.timezone === "string" ? body.timezone : "",
      postCount: calendar.length,
      automaticConfirmed: body.automaticConfirmed === true,
    });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Review the publishing plan." }, { status: 400 });
  }

  const [{ data: website }, { data: audit }, { data: approvedPreferenceRows }] = await Promise.all([
    supabase.from("websites").select("organization_id").eq("id", websiteId).maybeSingle(),
    supabase.from("audits").select("id").eq("id", auditId).eq("website_id", websiteId).maybeSingle(),
    supabase.from("keyword_preferences").select("keyword").eq("website_id", websiteId).eq("decision", "approved"),
  ]);
  if (!website?.organization_id || !audit) return NextResponse.json({ error: "This website or audit is not available to the account." }, { status: 404 });
  const approvedKeywords = (approvedPreferenceRows ?? []).flatMap((item) => typeof item.keyword === "string" ? [item.keyword] : []);
  if (!approvedKeywords.length) return NextResponse.json({ error: "Approve at least one keyword before creating a publishing plan." }, { status: 409 });
  if (unapprovedCalendarKeywords(calendar, approvedKeywords).length) {
    return NextResponse.json({ error: "The publishing plan contains topics that have not been approved for this website." }, { status: 409 });
  }

  const dates = buildWeeklySchedule(input.startDate, calendar.length, input.timezone);
  const db = supabase as unknown as SupabaseClient;
  const { data: plan, error: planError } = await db.from("publishing_plans").upsert({
    organization_id: website.organization_id,
    website_id: websiteId,
    audit_id: auditId,
    created_by: userId,
    mode: input.mode,
    status: "active",
    timezone: input.timezone,
    holdback_hours: 72,
    start_date: input.startDate,
    end_date: dates.at(-1)?.slice(0, 10),
    confirmed_post_count: calendar.length,
    automatic_confirmed_at: input.mode === "automatic" ? new Date().toISOString() : null,
  }, { onConflict: "website_id,audit_id" }).select("id,mode,status,timezone,holdback_hours,start_date,end_date,confirmed_post_count,automatic_confirmed_at").single();
  if (planError || !plan) return NextResponse.json({ error: "Destiny could not save the publishing plan." }, { status: 500 });

  const { data: existing } = await db.from("publishing_schedule_items").select("position,state").eq("plan_id", plan.id);
  const protectedPositions = new Set((existing ?? []).filter((item) => ["scheduled", "published", "managed_externally"].includes(item.state)).map((item) => item.position));
  const rows = calendar.filter((item) => !protectedPositions.has(item.position)).map((item, index) => ({
    plan_id: plan.id,
    organization_id: website.organization_id,
    website_id: websiteId,
    audit_id: auditId,
    position: item.position,
    keyword: item.keyword,
    normalized_keyword: normalizedKeyword(item.keyword),
    title: item.title,
    content_type: item.contentType,
    scheduled_for: dates[index],
    state: "planned",
    review_recommended: input.mode === "automatic" && item.position <= 2,
  }));
  const { error: itemError } = rows.length ? await db.from("publishing_schedule_items").upsert(rows, { onConflict: "plan_id,position" }) : { error: null };
  if (itemError) return NextResponse.json({ error: "The plan was saved, but Destiny could not save every calendar slot." }, { status: 500 });
  const { data: items } = await db.from("publishing_schedule_items").select("id,plan_id,position,keyword,title,content_type,scheduled_for,state,review_recommended,remote_edit_url,remote_permalink,last_error").eq("plan_id", plan.id).order("position");
  return NextResponse.json({ plan, items: items ?? [] });
}

export async function PATCH(request: Request) {
  const { supabase, userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in again to update the publishing plan." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const websiteId = validId(body.websiteId);
  const status = body.status === "paused" || body.status === "active" ? body.status : null;
  if (!websiteId || !status) return NextResponse.json({ error: "Choose a valid publishing plan action." }, { status: 400 });
  const db = supabase as unknown as SupabaseClient;
  const { data: plan, error } = await db.from("publishing_plans").update({ status }).eq("website_id", websiteId).select("id,mode,status,timezone,holdback_hours,start_date,end_date,confirmed_post_count,automatic_confirmed_at").single();
  if (error || !plan) return NextResponse.json({ error: "Destiny could not update the publishing plan." }, { status: 500 });
  return NextResponse.json({ plan });
}
