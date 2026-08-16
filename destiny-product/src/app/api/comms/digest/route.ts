import { NextResponse } from "next/server";
import { batchNotificationEvents } from "@/lib/comms/batching";
import type { NotificationEvent, NotificationEventType } from "@/lib/comms/contracts";
import { createClient } from "@/lib/supabase/server";
import { isWebsiteId, siteScopedHref } from "@/lib/workspace-selection";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function scope(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  const websiteId = new URL(request.url).searchParams.get("site");
  if (!userId || !isWebsiteId(websiteId)) return { supabase, userId, website: null };
  const { data: website } = await supabase.from("websites").select("id,organization_id,business_name,normalized_domain").eq("id", websiteId).maybeSingle();
  return { supabase, userId, website };
}

export async function GET(request: Request) {
  const { supabase, userId, website } = await scope(request);
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  if (!website) return NextResponse.json({ error: "Choose a website to view its updates." }, { status: 404 });
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("comms_notification_events").select("event_id,occurred_at,user_timezone,type,job,priority,grouping_key,dedupe_key,bypass_batch,render,payload")
    .eq("website_id", website.id).eq("user_id", userId).gte("occurred_at", since).order("occurred_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const events: NotificationEvent[] = (data ?? []).map((row) => {
    const render = object(row.render);
    return {
      eventId: row.event_id,
      accountId: website.organization_id,
      websiteId: website.id,
      userId,
      occurredAtUtc: row.occurred_at,
      userTimezone: row.user_timezone,
      type: row.type as NotificationEventType,
      job: row.job as NotificationEvent["job"],
      priority: row.priority as NotificationEvent["priority"],
      groupingKey: row.grouping_key,
      dedupeKey: row.dedupe_key,
      bypassBatch: row.bypass_batch,
      render: {
        title: typeof render.title === "string" ? render.title : "Destiny update",
        objectName: typeof render.objectName === "string" ? render.objectName : undefined,
        objectUrl: typeof render.objectUrl === "string" ? render.objectUrl : undefined,
        delta: typeof render.delta === "string" ? render.delta : undefined,
        timeCostMinutes: typeof render.timeCostMinutes === "number" ? render.timeCostMinutes : undefined,
      },
      payload: object(row.payload),
    };
  });
  const { batches } = batchNotificationEvents(events);
  const messageIds = batches.map((batch) => `batch:${batch.groupingKey}:${batch.latestAtUtc}`);
  const { data: dismissed } = messageIds.length
    ? await supabase.from("comms_message_outcomes").select("message_id").eq("website_id", website.id).eq("user_id", userId).eq("outcome", "dismiss").in("message_id", messageIds)
    : { data: [] };
  const dismissedIds = new Set((dismissed ?? []).map((outcome) => outcome.message_id));
  const websiteName = website.business_name?.trim() || website.normalized_domain;
  return NextResponse.json({ notifications: batches.flatMap((batch) => {
    const messageId = `batch:${batch.groupingKey}:${batch.latestAtUtc}`;
    if (dismissedIds.has(messageId)) return [];
    return [{
      id: messageId,
      kind: "comms_batch",
      title: batch.title,
      body: batch.count === 1 ? "One saved Destiny update." : `${batch.count} related updates were grouped to reduce noise.`,
      destination_path: batch.destinationUrl ? siteScopedHref(batch.destinationUrl, website.id) : siteScopedHref("/this-week", website.id),
      read_at: null,
      created_at: batch.latestAtUtc,
      website_id: website.id,
      website_name: websiteName,
      source: "comms_batch",
      event_ids: batch.events.map((event) => event.eventId),
      message_id: messageId,
    }];
  }) });
}

export async function POST(request: Request) {
  const { supabase, userId, website } = await scope(request);
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  if (!website) return NextResponse.json({ error: "Choose a website to update its digest." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { messageId?: unknown; messageIds?: unknown };
  const candidates = Array.isArray(body.messageIds) ? body.messageIds : [body.messageId];
  const messageIds = [...new Set(candidates.filter((value): value is string => typeof value === "string" && value.startsWith("batch:") && value.length <= 300))];
  if (!messageIds.length) return NextResponse.json({ error: "Choose a valid digest row." }, { status: 400 });
  const { error } = await supabase.from("comms_message_outcomes").insert(messageIds.map((messageId) => ({
    organization_id: website.organization_id,
    website_id: website.id,
    user_id: userId,
    message_id: messageId,
    outcome: "dismiss",
    metadata: { source: "in_app_digest" },
  })));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recorded: messageIds.length });
}
