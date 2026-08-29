import { NextResponse } from "next/server";
import { buildWeeklySchedule, publishingDeliveryMode, unapprovedCalendarKeywords, validatePublishingPlan, type PublishingMode } from "@/lib/content/publishing-plan";
import { scopedClient } from "@/lib/db";
import { parseBuilderProfile } from "@/lib/integrations/website-profile";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CalendarInput = { keyword?: unknown; title?: unknown; contentType?: unknown };
const ITEM_SELECT = "id,plan_id,position,keyword,title,content_type,related_article_title,scheduled_for,state,review_recommended,remote_id,remote_edit_url,remote_permalink,last_error";
const MANUAL_CONTENT_TYPES = new Map([
  ["article", "Article"],
  ["linkedin", "LinkedIn post"],
  ["x", "X post"],
  ["approved_draft", "Approved draft"],
]);

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

export async function GET(request: Request) {
  const websiteId = validId(new URL(request.url).searchParams.get("websiteId"));
  if (!websiteId) return NextResponse.json({ error: "Choose a valid website." }, { status: 400 });
  const db = await scopedClient(websiteId);
  const userId = await db.getClaims();
  if (!userId) return NextResponse.json({ error: "Sign in again to load the publishing plan." }, { status: 401 });
  const { data: plan, error } = await db.select("publishing_plans", "id,mode,status,timezone,holdback_hours,start_date,end_date,confirmed_post_count,automatic_confirmed_at").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Rebound SEO could not load the publishing plan." }, { status: 500 });
  const { data: items } = plan ? await db.select("publishing_schedule_items", ITEM_SELECT).eq("plan_id", plan.id).order("position") : { data: [] };
  return NextResponse.json({ plan, items: items ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const websiteId = validId(body.websiteId);
  const auditId = validId(body.auditId);
  const calendar = calendarInput(body.calendar);
  if (!websiteId || !auditId || !calendar.length) return NextResponse.json({ error: "The website, audit, or editorial calendar is incomplete." }, { status: 400 });
  const db = await scopedClient(websiteId);
  const userId = await db.getClaims();
  if (!userId) return NextResponse.json({ error: "Sign in again to save the publishing plan." }, { status: 401 });

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

  const [{ data: website }, { data: audit }, { data: approvedPreferenceRows }, { data: integrations }] = await Promise.all([
    db.website("organization_id,builder_profile").maybeSingle(),
    db.select("audits", "id").eq("id", auditId).maybeSingle(),
    db.select("keyword_preferences", "keyword").eq("decision", "approved"),
    db.select("integrations", "provider,status"),
  ]);
  if (!website?.organization_id || !audit) return NextResponse.json({ error: "This website or audit is not available to the account." }, { status: 404 });
  const approvedKeywords = (approvedPreferenceRows ?? []).flatMap((item) => typeof item.keyword === "string" ? [item.keyword] : []);
  if (!approvedKeywords.length) return NextResponse.json({ error: "Approve at least one keyword before creating a publishing plan." }, { status: 409 });
  if (unapprovedCalendarKeywords(calendar, approvedKeywords).length) {
    return NextResponse.json({ error: "The publishing plan contains topics that have not been approved for this website." }, { status: 409 });
  }
  const connectedProviders = new Set((integrations ?? []).filter((integration) => integration.status === "connected").map((integration) => integration.provider));
  const websitePlatform = parseBuilderProfile(website.builder_profile).platform;
  const deliveryMode = publishingDeliveryMode(websitePlatform, connectedProviders);
  const manualCmsPlan = deliveryMode === "manual_webflow" || deliveryMode === "manual_wix";
  if (deliveryMode === "unavailable") return NextResponse.json({ error: "Connect WordPress or Webflow before creating a publishing plan. Wix can use a guided manual plan." }, { status: 409 });
  if (manualCmsPlan && input.mode === "automatic") return NextResponse.json({ error: "Automatic CMS scheduling is available only for a verified WordPress connection." }, { status: 409 });

  const dates = buildWeeklySchedule(input.startDate, calendar.length, input.timezone);
  const { data: plan, error: planError } = await db.upsert("publishing_plans", {
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
  if (planError || !plan) return NextResponse.json({ error: "Rebound SEO could not save the publishing plan." }, { status: 500 });

  const { data: existing } = await db.select("publishing_schedule_items", "position,state").eq("plan_id", plan.id);
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
    state: manualCmsPlan ? "managed_externally" : "planned",
    review_recommended: input.mode === "automatic" && item.position <= 2,
  }));
  const { error: itemError } = rows.length ? await db.upsert("publishing_schedule_items", rows, { onConflict: "plan_id,position" }) : { error: null };
  if (itemError) return NextResponse.json({ error: "The plan was saved, but Rebound SEO could not save every calendar slot." }, { status: 500 });
  const { data: items } = await db.select("publishing_schedule_items", ITEM_SELECT).eq("plan_id", plan.id).order("position");
  return NextResponse.json({ plan, items: items ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const websiteId = validId(body.websiteId);
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 500) : "";
  const contentType = typeof body.contentType === "string" ? MANUAL_CONTENT_TYPES.get(body.contentType) : null;
  const focusKeyword = typeof body.focusKeyword === "string" ? body.focusKeyword.trim().slice(0, 300) : "";
  const relatedArticleTitle = typeof body.relatedArticleTitle === "string" ? body.relatedArticleTitle.trim().slice(0, 500) : "";
  const scheduledFor = typeof body.scheduledFor === "string" && Number.isFinite(Date.parse(body.scheduledFor)) ? new Date(body.scheduledFor).toISOString() : null;
  if (!websiteId || !title || !contentType || !scheduledFor) return NextResponse.json({ error: "Choose a content type, title, and date." }, { status: 400 });
  const db = await scopedClient(websiteId);
  const userId = await db.getClaims();
  if (!userId) return NextResponse.json({ error: "Sign in again to add content." }, { status: 401 });
  if ((contentType === "Article" || contentType === "Approved draft") && !focusKeyword) return NextResponse.json({ error: "Add the focus keyword for this article." }, { status: 400 });
  if ((contentType === "LinkedIn post" || contentType === "X post") && !relatedArticleTitle) return NextResponse.json({ error: "Choose the article this social post will promote." }, { status: 400 });

  const { data: plan, error: planError } = await db.select("publishing_plans", "id,organization_id,website_id,audit_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planError || !plan) return NextResponse.json({ error: "Create a publishing plan before adding calendar content." }, { status: 409 });
  const { data: existing, error: existingError } = await db.select("publishing_schedule_items", "position").eq("plan_id", plan.id).order("position", { ascending: false }).limit(1);
  if (existingError) return NextResponse.json({ error: "Rebound SEO could not check the calendar." }, { status: 500 });
  const position = Number(existing?.[0]?.position ?? 0) + 1;
  if (position > 72) return NextResponse.json({ error: "This calendar already has 72 items. Move or remove an item before adding another." }, { status: 409 });
  const keyword = focusKeyword || relatedArticleTitle;
  const { data: item, error } = await db.insert("publishing_schedule_items", {
    plan_id: plan.id,
    organization_id: plan.organization_id,
    website_id: plan.website_id,
    audit_id: plan.audit_id,
    position,
    keyword,
    normalized_keyword: `${normalizedKeyword(keyword)} ${position}`.slice(0, 300),
    title,
    content_type: contentType,
    related_article_title: relatedArticleTitle || null,
    scheduled_for: scheduledFor,
    state: "planned",
    review_recommended: false,
  }).select(ITEM_SELECT).single();
  if (error || !item) return NextResponse.json({ error: "Rebound SEO could not add this content to the calendar." }, { status: 500 });
  return NextResponse.json({ item }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const websiteId = validId(body.websiteId);
  const status = body.status === "paused" || body.status === "active" ? body.status : null;
  if (!websiteId || !status) return NextResponse.json({ error: "Choose a valid publishing plan action." }, { status: 400 });
  const db = await scopedClient(websiteId);
  const userId = await db.getClaims();
  if (!userId) return NextResponse.json({ error: "Sign in again to update the publishing plan." }, { status: 401 });
  const { data: plan, error } = await db.update("publishing_plans", { status }).select("id,mode,status,timezone,holdback_hours,start_date,end_date,confirmed_post_count,automatic_confirmed_at").single();
  if (error || !plan) return NextResponse.json({ error: "Rebound SEO could not update the publishing plan." }, { status: 500 });
  return NextResponse.json({ plan });
}
