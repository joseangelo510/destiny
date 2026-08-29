import { NextResponse } from "next/server";
import sharp from "sharp";
import { currentArticleQualityIssues, type ArticleDraft } from "@/lib/content/article-draft";
import { prepareWordPressDraft } from "@/lib/cms/wordpress-draft";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";
import { scopedClient } from "@/lib/db";
import { isArticleCalendarItem, wordpressRemoteIdFromEditUrl } from "@/lib/content/publishing-plan";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { websiteId?: unknown };
  const websiteId = typeof body.websiteId === "string" && UUID.test(body.websiteId) ? body.websiteId : null;
  if (!websiteId) return NextResponse.json({ error: "Choose a valid website." }, { status: 400 });
  const db = await scopedClient(websiteId);
  const userId = await db.getClaims();
  if (!userId) return NextResponse.json({ error: "Sign in again to run the publishing checks." }, { status: 401 });
  const { data: plan } = await db.select("publishing_plans", "id,audit_id,mode,status,holdback_hours,confirmed_post_count").maybeSingle();
  if (!plan || plan.status !== "active" || plan.mode === "review_each") return NextResponse.json({ error: "Choose an active batch or automatic publishing plan first." }, { status: 409 });

  const [{ data: items }, { data: draftRows }] = await Promise.all([
    db.select("publishing_schedule_items", "id,plan_id,position,keyword,content_type,scheduled_for,state").in("state", ["planned", "needs_review", "failed"]).order("position"),
    db.select("article_drafts", "keyword,draft").eq("audit_id", plan.audit_id),
  ]);
  const drafts = new Map((draftRows ?? []).flatMap((row) => row.draft && typeof row.draft === "object" && !Array.isArray(row.draft)
    ? [[normalizeTrackedKeyword(row.keyword), row.draft as ArticleDraft] as const]
    : []));
  const results: Array<{ keyword: string; state: string; message: string }> = [];
  const usedDrafts = new Set<string>();

  for (const item of (items ?? []).filter((entry) => entry.plan_id === plan.id && isArticleCalendarItem(entry, plan.confirmed_post_count))) {
    const normalized = normalizeTrackedKeyword(item.keyword);
    if (usedDrafts.has(normalized)) {
      results.push({ keyword: item.keyword, state: "planned", message: "Waiting for a distinct article brief for this later topic angle." });
      continue;
    }
    const draft = drafts.get(normalized);
    if (!draft || draft.generationStatus !== "generated") {
      results.push({ keyword: item.keyword, state: "planned", message: "Waiting for the full article." });
      continue;
    }
    usedDrafts.add(normalized);
    if (plan.mode === "batch_schedule" && (draft as ArticleDraft & { approved?: boolean }).approved !== true) {
      await db.update("publishing_schedule_items", { state: "needs_review", last_error: "Approve this article for the batch first." }, { id: item.id });
      results.push({ keyword: item.keyword, state: "needs_review", message: "Waiting for batch approval." });
      continue;
    }
    const issues = await currentArticleQualityIssues(draft);
    if (issues.length) {
      await db.update("publishing_schedule_items", { state: "needs_review", last_error: issues[0].message }, { id: item.id });
      results.push({ keyword: item.keyword, state: "needs_review", message: issues[0].message });
      continue;
    }
    let prepared: ReturnType<typeof prepareWordPressDraft>;
    try {
      prepared = prepareWordPressDraft({ ...draft, websiteId, auditId: plan.audit_id, approved: true, scheduledFor: item.scheduled_for });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The article did not pass the scheduling gate.";
      await db.update("publishing_schedule_items", { state: "needs_review", last_error: message }, { id: item.id });
      results.push({ keyword: item.keyword, state: "needs_review", message });
      continue;
    }
    const media = await Promise.all([prepared.featuredGraphic, ...prepared.graphics].map(async (graphic) => ({
      filename: `${graphic.name}.webp`, mimeType: "image/webp",
      base64: (await sharp(Buffer.from(graphic.svg)).webp({ quality: 88 }).toBuffer()).toString("base64"),
      alt: graphic.alt, role: graphic.role, caption: graphic.caption, placementAfterHeading: graphic.placementAfterHeading,
    })));
    const { data, error } = await db.invokeFunction<{ delivered?: boolean; remoteEditUrl?: string; publicationStatus?: string; error?: string }>("wordpress-draft", { ...prepared, featuredGraphic: undefined, graphics: undefined, media });
    if (error || !data?.delivered || data.publicationStatus !== "scheduled") {
      const message = data?.error || "WordPress did not confirm the future publication date.";
      await db.update("publishing_schedule_items", { state: "failed", last_error: message, attempt_count: 1 }, { id: item.id });
      results.push({ keyword: item.keyword, state: "failed", message });
      continue;
    }
    await db.update("publishing_schedule_items", { state: "scheduled", article_key: prepared.articleKey, remote_id: wordpressRemoteIdFromEditUrl(data.remoteEditUrl), remote_edit_url: data.remoteEditUrl, last_error: null, attempt_count: 1 }, { id: item.id });
    results.push({ keyword: item.keyword, state: "scheduled", message: "Scheduled in WordPress." });
  }

  const { data: refreshedItems, error: refreshedItemsError } = await db
    .select("publishing_schedule_items", "id,plan_id,position,keyword,title,content_type,related_article_title,scheduled_for,state,review_recommended,remote_id,remote_edit_url,remote_permalink,last_error")
    .order("position");
  if (refreshedItemsError) return NextResponse.json({ error: "The scheduling check finished, but Rebound SEO could not refresh the queue." }, { status: 500 });
  return NextResponse.json({ checked: results.length, scheduled: results.filter((item) => item.state === "scheduled").length, results, items: (refreshedItems ?? []).filter((item) => item.plan_id === plan.id) }, { headers: { "Cache-Control": "no-store" } });
}
