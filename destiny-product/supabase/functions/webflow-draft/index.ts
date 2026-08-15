import { withSupabase } from "@supabase/server";
import {
  canReclaimPendingTransfer,
  classifyWebflowFailure,
  establishedFieldValues,
  findItemIdBySlug,
  planWebflowFieldData,
  prepareDraftBody,
  applyImageFallbackToReport,
  stripEmbeddedGraphics,
  stripImageFieldData,
  webflowCollectionEndpoint,
  webflowCreateItemEndpoint,
  webflowEditUrl,
  webflowItemPayload,
  webflowItemSlug,
  webflowListItemsEndpoint,
  webflowUpdateItemEndpoint,
  type FieldReportEntry,
  type WebflowFieldSchema,
} from "./logic.ts";

type ConnectionSecret = {
  integration_id?: unknown;
  credentials?: unknown;
};

const GRAPHICS_BUCKET = "article-graphics";
/** Thrown when a worker's pending lease was reclaimed — it must stop without any external side effect. */
class LeaseLostError extends Error {}

const WEBFLOW_TIMEOUT_MS = 20_000;

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function contentHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function webflowHeaders(apiToken: string) {
  return { Authorization: `Bearer ${apiToken}`, Accept: "application/json", "Content-Type": "application/json" };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    let draft: ReturnType<typeof prepareDraftBody>;
    try { draft = prepareDraftBody(await request.json() as Record<string, unknown>); }
    catch (cause) { return json({ error: cause instanceof Error ? cause.message : "Review the approved article." }, 400); }

    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to continue." }, 401);

    const { data: website } = await context.supabase.from("websites").select("id").eq("id", draft.websiteId).maybeSingle();
    if (!website) return json({ error: "You do not have access to that website." }, 403);

    const { data: stored, error: credentialError } = await context.supabaseAdmin.rpc("read_webflow_connection_credentials", {
      p_user_id: userId,
      p_website_id: draft.websiteId,
    });
    const secret = stored && typeof stored === "object" && !Array.isArray(stored) ? stored as ConnectionSecret : {};
    const credentials = secret.credentials && typeof secret.credentials === "object" && !Array.isArray(secret.credentials)
      ? secret.credentials as Record<string, unknown>
      : {};
    const integrationId = typeof secret.integration_id === "string" ? secret.integration_id : "";
    const apiToken = typeof credentials.api_token === "string" ? credentials.api_token : "";
    const collectionId = typeof credentials.collection_id === "string" ? credentials.collection_id : "";
    const titleField = typeof credentials.title_field === "string" && credentials.title_field ? credentials.title_field : "name";
    const bodyField = typeof credentials.body_field === "string" ? credentials.body_field : "";
    const siteShortName = typeof credentials.site_short_name === "string" ? credentials.site_short_name : "";
    const configuredDefaults = credentials.field_defaults && typeof credentials.field_defaults === "object" && !Array.isArray(credentials.field_defaults)
      ? credentials.field_defaults as Record<string, unknown>
      : {};
    if (credentialError || !integrationId || !apiToken || !collectionId || !bodyField) {
      return json({ error: "Connect Webflow before sending this article." }, 409);
    }

    // Live schema read on every send: field mapping follows the collection as
    // it is today, so a renamed or added field is never written blind.
    let collectionFields: WebflowFieldSchema[];
    const existingItems: Array<{ id?: unknown; fieldData?: unknown }> = [];
    try {
      const collectionResponse = await fetch(webflowCollectionEndpoint(collectionId), { headers: webflowHeaders(apiToken), signal: AbortSignal.timeout(WEBFLOW_TIMEOUT_MS) });
      if (!collectionResponse.ok) {
        const errorClass = classifyWebflowFailure(collectionResponse.status);
        return json({ error: errorClass === "authorization_failed" ? "Webflow access needs attention. Reconnect it and try again." : "Destiny could not read the Webflow collection. Test the connection and try again." }, 502);
      }
      const collection = await collectionResponse.json().catch(() => ({})) as { fields?: unknown };
      collectionFields = Array.isArray(collection.fields) ? collection.fields as WebflowFieldSchema[] : [];
      // Page through existing items (capped) so established-value sampling and
      // orphan adoption see more than the first page.
      for (let offset = 0; offset < 500; offset += 100) {
        const itemsResponse = await fetch(`${webflowListItemsEndpoint(collectionId)}&offset=${offset}`, { headers: webflowHeaders(apiToken), signal: AbortSignal.timeout(WEBFLOW_TIMEOUT_MS) });
        if (!itemsResponse.ok) break;
        const itemsBody = await itemsResponse.json().catch(() => ({})) as { items?: unknown };
        const page = Array.isArray(itemsBody.items) ? itemsBody.items as Array<{ id?: unknown; fieldData?: unknown }> : [];
        existingItems.push(...page);
        if (page.length < 100) break;
      }
    } catch {
      return json({ error: "Destiny could not reach Webflow. Test the connection and try again." }, 502);
    }
    if (!collectionFields.some((field) => field.slug === bodyField)) {
      return json({ error: "The connected Webflow collection no longer has the configured article body field. Reconnect Webflow to re-select it." }, 409);
    }

    const slug = webflowItemSlug(draft.title, draft.articleKey);

    // Original Destiny graphics: host them so Webflow can ingest them with alt text.
    const graphicReport: FieldReportEntry[] = [];
    // Positional: a null keeps the ordinal of a graphic that failed to host,
    // so the first *original* graphic alone may claim main/thumbnail fields.
    const hostedGraphics: Array<{ url: string; alt: string } | null> = [];
    for (const [index, graphic] of draft.graphics.entries()) {
      const path = `${integrationId}/${slug}/graphic-${index + 1}.svg`;
      const { error: uploadError } = await context.supabaseAdmin.storage.from(GRAPHICS_BUCKET)
        .upload(path, new Blob([graphic.svg], { type: "image/svg+xml" }), { contentType: "image/svg+xml", upsert: true });
      if (uploadError) {
        graphicReport.push({ field: "", label: `Graphic “${graphic.name}”`, status: "needs_review", note: "Destiny could not host this graphic — download it from the article workspace and add it in Webflow." });
        hostedGraphics.push(null);
        continue;
      }
      const { data: publicUrl } = context.supabaseAdmin.storage.from(GRAPHICS_BUCKET).getPublicUrl(path);
      if (publicUrl?.publicUrl) {
        hostedGraphics.push({ url: publicUrl.publicUrl, alt: graphic.alt });
      } else {
        graphicReport.push({ field: "", label: `Graphic “${graphic.name}”`, status: "needs_review", note: "Destiny could not host this graphic — download it from the article workspace and add it in Webflow." });
        hostedGraphics.push(null);
      }
    }

    const established = {
      ...establishedFieldValues(existingItems, collectionFields.flatMap((field) => typeof field.slug === "string" && field.slug ? [field.slug] : [])),
      ...configuredDefaults,
    };

    const buildPlan = (includeSlug: boolean) => planWebflowFieldData({
      fields: collectionFields,
      titleField,
      bodyField,
      article: {
        title: draft.title,
        metaTitle: draft.metaTitle,
        contentHtml: draft.contentHtml,
        metaDescription: draft.metaDescription,
        wordCount: draft.wordCount,
        publishDateIso: new Date().toISOString(),
        graphics: hostedGraphics,
      },
      established,
      slug,
      includeSlug,
    });

    const createPlan = buildPlan(true);
    const hash = await contentHash(JSON.stringify(createPlan.stableFieldData));
    const { data: existing } = await context.supabaseAdmin.from("cms_transfers")
      .select("id,status,content_hash,remote_id,remote_edit_url,attempt_count,updated_at,field_report")
      .eq("integration_id", integrationId)
      .eq("article_key", draft.articleKey)
      .maybeSingle();
    const remoteEditUrl = webflowEditUrl(siteShortName);

    // A pending row is a lease, not a permanent lock: an interrupted worker
    // must not wedge the article. Expired leases are reclaimed below via the
    // same conditional update as any other claim.
    if (existing?.status === "pending" && !canReclaimPendingTransfer(existing.updated_at, Date.now())) {
      return json({ error: "Destiny is already sending this article to Webflow." }, 409);
    }
    if (existing?.status === "succeeded" && existing.content_hash === hash && existing.remote_edit_url) {
      // Return the report that was actually delivered (e.g. after an image
      // fallback), never a freshly recomputed, more optimistic one.
      const storedReport = Array.isArray(existing.field_report) ? existing.field_report as FieldReportEntry[] : null;
      return json({ delivered: true, remoteEditUrl: existing.remote_edit_url, reused: true, fieldReport: storedReport ?? [...createPlan.report, ...graphicReport] });
    }

    // Update-in-place: after a successful first send, changed content PATCHes
    // the same remote item (same ID, same slug). Create only when no remote
    // item exists yet.
    const isUpdate = existing?.status === "succeeded" && typeof existing.remote_id === "string" && existing.remote_id.length > 0;
    // Retry after a partial failure: a failed row that already carries a
    // remote item ID must update that item, never create a duplicate.
    const failedRemoteId = existing?.status === "failed" && typeof existing.remote_id === "string" ? existing.remote_id : "";

    // Claim the transfer atomically. Concurrent sends and double-clicks lose
    // the conditional update (or the unique insert) and back off instead of
    // double-posting to Webflow.
    // The claim timestamp doubles as an ownership token: every terminal or
    // follow-up write requires (status='pending', updated_at=ownedStamp), so a
    // worker whose expired lease was reclaimed can no longer touch the row.
    const claimStamp = new Date().toISOString();
    let ownedStamp = claimStamp;
    if (existing) {
      let claimQuery = context.supabaseAdmin.from("cms_transfers")
        .update({ status: "pending", error_class: null, error_detail: null, attempt_count: (typeof existing.attempt_count === "number" ? existing.attempt_count : 0) + 1, updated_at: claimStamp })
        .eq("id", existing.id)
        .eq("status", existing.status)
        .eq("content_hash", existing.content_hash ?? "");
      if (existing.status === "pending" && typeof existing.updated_at === "string") {
        // Reclaim an expired lease only if nobody has touched the row since we read it.
        claimQuery = claimQuery.eq("updated_at", existing.updated_at);
      }
      const { data: claimed, error: claimError } = await claimQuery.select("id");
      if (claimError || !claimed?.length) return json({ error: "Destiny is already sending this article to Webflow." }, 409);
    } else {
      const { error: insertError } = await context.supabaseAdmin.from("cms_transfers").insert({
        website_id: draft.websiteId,
        integration_id: integrationId,
        article_key: draft.articleKey,
        content_hash: hash,
        status: "pending",
        attempt_count: 1,
        updated_at: claimStamp,
      });
      if (insertError) return json({ error: "Destiny is already sending this article to Webflow." }, 409);
    }

    const markFailed = async (errorClass: string, detail: string, clearRemoteId = false) => {
      await context.supabaseAdmin.from("cms_transfers")
        .update({ status: "failed", error_class: errorClass, error_detail: detail, ...(clearRemoteId ? { remote_id: null } : {}), updated_at: new Date().toISOString() })
        .eq("integration_id", integrationId).eq("article_key", draft.articleKey)
        .eq("status", "pending")
        .eq("updated_at", ownedStamp);
    };

    // A lease expiry is an authorization boundary for external side effects,
    // not just database writes. Immediately before every Webflow mutation the
    // worker atomically renews its lease against the current ownership token;
    // a stale worker whose lease was reclaimed fails the renewal and stops
    // without touching Webflow — no duplicate remote drafts. Renewal also
    // resets the lease clock, keeping the 3-minute lease far above the ~20s
    // bounded Webflow call it protects.
    const renewLease = async () => {
      const nextStamp = new Date().toISOString();
      if (nextStamp === ownedStamp) return true;
      const { data: renewed, error: renewError } = await context.supabaseAdmin.from("cms_transfers")
        .update({ updated_at: nextStamp })
        .eq("integration_id", integrationId).eq("article_key", draft.articleKey)
        .eq("status", "pending")
        .eq("updated_at", ownedStamp)
        .select("id");
      if (renewError || !renewed?.length) return false;
      ownedStamp = nextStamp;
      return true;
    };

    let targetItemId = isUpdate ? existing!.remote_id as string : failedRemoteId;
    if (!targetItemId) {
      // Duplicate guard: if a previous attempt created the item but the result
      // was lost, our deterministic slug identifies it — adopt it instead of
      // creating a second one.
      targetItemId = findItemIdBySlug(existingItems, slug);
    }

    const plan = targetItemId ? buildPlan(false) : createPlan;
    const sendToWebflow = async (fieldData: Record<string, unknown>) => {
      if (!(await renewLease())) throw new LeaseLostError();
      const endpoint = targetItemId ? webflowUpdateItemEndpoint(collectionId, targetItemId) : webflowCreateItemEndpoint(collectionId);
      return fetch(endpoint, {
        method: targetItemId ? "PATCH" : "POST",
        headers: webflowHeaders(apiToken),
        body: JSON.stringify(webflowItemPayload(fieldData)),
        signal: AbortSignal.timeout(WEBFLOW_TIMEOUT_MS),
      });
    };

    let fieldReport = [...plan.report, ...graphicReport];
    let response: Response;
    try {
      response = await sendToWebflow(plan.fieldData);
      // Webflow can reject externally hosted images; deliver everything else
      // rather than silently failing, and say so in the report.
      if (response.status === 400 && (plan.imageFieldSlugs.length || plan.embeddedGraphicCount)) {
        const fallbackFieldData = stripImageFieldData(plan.fieldData, plan.imageFieldSlugs);
        if (plan.embeddedGraphicCount && typeof fallbackFieldData[bodyField] === "string") {
          fallbackFieldData[bodyField] = stripEmbeddedGraphics(fallbackFieldData[bodyField] as string);
        }
        response = await sendToWebflow(fallbackFieldData);
        if (response.ok) {
          fieldReport = applyImageFallbackToReport(fieldReport, plan.imageFieldSlugs, plan.embeddedGraphicCount);
        }
      }
    } catch (error) {
      if (error instanceof LeaseLostError) {
        // Another delivery reclaimed this transfer; it owns the row and the
        // remote item now. Stop without any Webflow call or row change.
        return json({ error: "Another delivery of this article took over. Refresh to see its status." }, 409);
      }
      await markFailed("unreachable", "Webflow did not respond.");
      return json({ error: "Destiny could not reach Webflow. Test the connection and try again." }, 502);
    }

    if (targetItemId && response.status === 404) {
      await markFailed("remote_item_missing", "The Webflow draft item no longer exists.", true);
      return json({ error: "The Webflow draft was deleted in Webflow. Send the article again to create a fresh draft." }, 409);
    }

    const remote = await response.json().catch(() => ({})) as { id?: unknown };
    const remoteId = typeof remote.id === "string" && remote.id ? remote.id : targetItemId;
    if (!response.ok || !remoteId) {
      const errorClass = classifyWebflowFailure(response.status);
      await markFailed(errorClass, `Webflow returned ${response.status}.`);
      return json({ error: errorClass === "authorization_failed" ? "Webflow access needs attention. Reconnect it and try again." : `Webflow did not accept the draft (status ${response.status}). Review the connection and try again.` }, 502);
    }

    const { data: completed, error: completionError } = await context.supabaseAdmin.from("cms_transfers").update({
      status: "succeeded",
      content_hash: hash,
      remote_id: remoteId,
      remote_edit_url: remoteEditUrl,
      field_report: fieldReport,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("integration_id", integrationId).eq("article_key", draft.articleKey)
      .eq("status", "pending")
      .eq("updated_at", ownedStamp)
      .select("id");
    if (completionError || !completed?.length) {
      if (!completionError) {
        // Zero rows matched: our lease was reclaimed while we were talking to
        // Webflow. The new owner controls the row now — do not alter it.
        return json({ error: "Another delivery of this article finished first. Refresh to see its status." }, 409);
      }
      // The remote item exists; keep its ID on the failed row so the retry
      // updates it instead of creating a duplicate. Both writes stay guarded
      // by our claim token.
      await markFailed("save_link_failed", "Draft delivered but Destiny could not save its link.");
      await context.supabaseAdmin.from("cms_transfers").update({ remote_id: remoteId, updated_at: new Date().toISOString() })
        .eq("integration_id", integrationId).eq("article_key", draft.articleKey)
        .eq("status", "failed").eq("error_class", "save_link_failed");
      return json({ error: "The Webflow draft item was saved, but Destiny could not record its link. Try again — Destiny will update the same draft." }, 502);
    }

    return json({ delivered: true, remoteEditUrl, updated: Boolean(targetItemId), fieldReport });
  }),
};
