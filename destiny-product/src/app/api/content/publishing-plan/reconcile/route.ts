import { NextResponse } from "next/server";
import { scopedClient } from "@/lib/db";
import { matchingWordPressPublication, needsWordPressScheduleVerification, wordpressPublishingScheduleUpdate, type PublishingScheduleItemRecord } from "@/lib/content/publishing-plan";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReconcileResult = {
  reconciled?: boolean;
  publicationStatus?: string;
  remotePermalink?: string | null;
  verifiedLiveAt?: string | null;
  verificationEvidence?: unknown;
  error?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { websiteId?: unknown; itemId?: unknown };
  const websiteId = typeof body.websiteId === "string" && UUID.test(body.websiteId) ? body.websiteId : "";
  const itemId = typeof body.itemId === "string" && UUID.test(body.itemId) ? body.itemId : "";
  if (!websiteId || !itemId) return NextResponse.json({ error: "Choose a valid WordPress calendar item." }, { status: 400 });

  const db = await scopedClient(websiteId);
  if (!await db.getClaims()) return NextResponse.json({ error: "Sign in again to check WordPress." }, { status: 401 });

  const { data: item, error: itemError } = await db
    .select("publishing_schedule_items", "id,article_key,content_type,state,scheduled_for,remote_id,remote_edit_url,remote_permalink,last_error")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError || !item) return NextResponse.json({ error: "Rebound SEO could not find that calendar item for this website." }, { status: 404 });
  const verificationItem = {
    content_type: item.content_type,
    state: item.state as PublishingScheduleItemRecord["state"],
    scheduled_for: item.scheduled_for,
    remote_id: item.remote_id,
  };
  if (!needsWordPressScheduleVerification(verificationItem, "wordpress", true) || typeof item.article_key !== "string" || !item.article_key.trim()) {
    return NextResponse.json({ error: "Only a past-due scheduled WordPress article can be checked here." }, { status: 409 });
  }

  const { data, error } = await db.invokeFunction<ReconcileResult>("wordpress-reconcile", { websiteId, articleKey: item.article_key });
  if (error || !data?.reconciled) return NextResponse.json({ error: data?.error || "Rebound SEO could not verify this WordPress post." }, { status: 502 });

  const preliminaryEvidence = data.verificationEvidence && typeof data.verificationEvidence === "object" && !Array.isArray(data.verificationEvidence)
    ? data.verificationEvidence as Record<string, unknown> : {};
  const preliminarySchedule = wordpressPublishingScheduleUpdate({
    publicationStatus: data.publicationStatus,
    remoteStatus: typeof preliminaryEvidence.remoteStatus === "string" ? preliminaryEvidence.remoteStatus : null,
    remotePermalink: data.remotePermalink,
    verificationReason: typeof preliminaryEvidence.reason === "string" ? preliminaryEvidence.reason : null,
  });
  if (!preliminarySchedule.published) {
    return NextResponse.json({ verified: false, state: "scheduled", publicationStatus: data.publicationStatus ?? "unknown" }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data: receipts, error: receiptError } = await db.readCmsTransferStates();
  if (receiptError || !Array.isArray(receipts)) return NextResponse.json({ error: "WordPress was checked, but Rebound SEO could not read the saved publishing result." }, { status: 503 });
  const receipt = matchingWordPressPublication(receipts, {
    articleKey: item.article_key,
    publicationStatus: data.publicationStatus,
    remoteId: typeof item.remote_id === "string" ? item.remote_id : null,
    remoteEditUrl: typeof item.remote_edit_url === "string" ? item.remote_edit_url : null,
    remotePermalink: data.remotePermalink,
  });
  if (!receipt) return NextResponse.json({ error: "The WordPress result does not match this exact calendar post. No status was changed." }, { status: 409 });
  const evidence = receipt.verificationEvidence && typeof receipt.verificationEvidence === "object" && !Array.isArray(receipt.verificationEvidence)
    ? receipt.verificationEvidence as Record<string, unknown> : preliminaryEvidence;
  const schedule = wordpressPublishingScheduleUpdate({
    publicationStatus: typeof receipt.publicationStatus === "string" ? receipt.publicationStatus : data.publicationStatus,
    remoteStatus: typeof receipt.remoteStatus === "string" ? receipt.remoteStatus : null,
    remotePermalink: typeof receipt.remotePermalink === "string" ? receipt.remotePermalink : data.remotePermalink,
    verificationReason: typeof evidence.reason === "string" ? evidence.reason : null,
  });

  const update = {
    state: schedule.state,
    remote_permalink: schedule.remotePermalink,
    last_error: schedule.lastError,
  };
  const { error: updateError } = await db.update("publishing_schedule_items", update, { id: itemId });
  if (updateError) return NextResponse.json({ error: "WordPress verified the post, but Rebound SEO could not refresh the calendar." }, { status: 502 });

  return NextResponse.json({
    verified: schedule.verified,
    published: true,
    state: schedule.state,
    remotePermalink: schedule.remotePermalink,
    lastError: schedule.lastError,
    publicationStatus: data.publicationStatus,
    verifiedLiveAt: schedule.verified ? data.verifiedLiveAt ?? null : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
