import { NextResponse } from "next/server";
import { scopedClient } from "@/lib/db";
import { needsWordPressScheduleVerification, PUBLISHED_WORDPRESS_REVIEW_PREFIX, wordpressRemoteIdFromEditUrl, type PublishingScheduleItemRecord } from "@/lib/content/publishing-plan";
import { publishedWordPressTransfer } from "@/lib/rebound-core/wordpress-article-state";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReconcileResult = {
  reconciled?: boolean;
  publicationStatus?: string;
  remotePermalink?: string | null;
  verifiedLiveAt?: string | null;
  verificationEvidence?: { reason?: unknown } | null;
  error?: string;
};

function exactPublicUrl(value: unknown, editUrl: unknown) {
  if (typeof value !== "string" || typeof editUrl !== "string") return null;
  try {
    const publicUrl = new URL(value);
    const editor = new URL(editUrl);
    return publicUrl.protocol === "https:" && publicUrl.origin === editor.origin ? publicUrl.toString() : null;
  } catch {
    return null;
  }
}

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

  const { data: transfers, error: transferError } = await db.readCmsTransferStates();
  if (transferError || !Array.isArray(transfers)) return NextResponse.json({ error: "WordPress was checked, but Rebound SEO could not read the saved publishing result." }, { status: 503 });
  const transfer = publishedWordPressTransfer(transfers, item.article_key);
  const publicUrl = exactPublicUrl(data.remotePermalink, item.remote_edit_url);
  if (!transfer || !publicUrl || transfer.publicationStatus !== data.publicationStatus
    || transfer.remotePermalink !== publicUrl || wordpressRemoteIdFromEditUrl(transfer.remoteEditUrl as string) !== item.remote_id) {
    return NextResponse.json({ error: "The WordPress result does not match this exact calendar post. No status was changed." }, { status: 409 });
  }

  const verified = data.publicationStatus === "verified_live";
  if (!verified) {
    if (data.publicationStatus === "verification_failed") {
      const evidence = transfer.verificationEvidence && typeof transfer.verificationEvidence === "object" && !Array.isArray(transfer.verificationEvidence)
        ? transfer.verificationEvidence as Record<string, unknown> : {};
      const reason = typeof evidence.reason === "string" && evidence.reason.trim() ? evidence.reason.trim() : "Public verification needs review.";
      const reviewDetail = `${PUBLISHED_WORDPRESS_REVIEW_PREFIX}${reason.charAt(0).toLocaleLowerCase()}${reason.slice(1)}`;
      const { error: updateError } = await db.update("publishing_schedule_items", { remote_permalink: publicUrl, last_error: reviewDetail }, { id: itemId });
      if (updateError) return NextResponse.json({ error: "WordPress confirmed publication, but Rebound SEO could not update the calendar review state." }, { status: 502 });
      return NextResponse.json({ verified: false, state: "scheduled", publishedNeedsReview: true, publicationStatus: data.publicationStatus, remotePermalink: publicUrl, lastError: reviewDetail }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ verified: false, state: "scheduled", publicationStatus: data.publicationStatus ?? "unknown" }, { headers: { "Cache-Control": "no-store" } });
  }

  const update = {
    state: "published",
    remote_permalink: publicUrl,
    last_error: null,
  };
  const { error: updateError } = await db.update("publishing_schedule_items", update, { id: itemId });
  if (updateError) return NextResponse.json({ error: "WordPress verified the post, but Rebound SEO could not refresh the calendar." }, { status: 502 });

  return NextResponse.json({ verified: true, state: "published", remotePermalink: publicUrl, verifiedLiveAt: data.verifiedLiveAt ?? null }, { headers: { "Cache-Control": "no-store" } });
}
