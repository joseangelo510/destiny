import { withSupabase } from "@supabase/server";
import {
  evaluateCollectionFields,
  prepareToken,
  selectBodyField,
  webflowCollectionEndpoint,
  webflowCollectionsEndpoint,
  webflowSitesEndpoint,
} from "./logic.ts";

type Body = {
  action?: unknown;
  websiteId?: unknown;
  apiToken?: unknown;
  siteId?: unknown;
  collectionId?: unknown;
  bodyField?: unknown;
};

const MAX_COLLECTIONS = 25;

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

async function webflowGet(url: string, token: string) {
  const response = await fetch(url, { headers: authHeaders(token), signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, payload };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    let body: Body;
    try { body = await request.json() as Body; }
    catch { return json({ error: "Check the Webflow connection details." }, 400); }

    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to continue." }, 401);

    const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
    if (!websiteId) return json({ error: "Complete onboarding before connecting Webflow." }, 400);
    const { data: website } = await context.supabase.from("websites").select("id").eq("id", websiteId).maybeSingle();
    if (!website) return json({ error: "You do not have access to that website." }, 403);

    let token: string;
    try { token = prepareToken(body.apiToken); }
    catch (cause) { return json({ error: cause instanceof Error ? cause.message : "Enter a valid Webflow site API token." }, 400); }

    const action = body.action === "connect" ? "connect" : "discover";

    let sitesResult: Awaited<ReturnType<typeof webflowGet>>;
    try { sitesResult = await webflowGet(webflowSitesEndpoint(), token); }
    catch { return json({ error: "Destiny could not reach the Webflow API." }, 502); }
    if (sitesResult.response.status === 401 || sitesResult.response.status === 403) {
      return json({ error: "Webflow rejected that API token. Create a site token with CMS read and write access." }, 400);
    }
    if (!sitesResult.response.ok) return json({ error: "Webflow could not list your sites. Try again." }, 502);
    const sites = (Array.isArray(sitesResult.payload.sites) ? sitesResult.payload.sites : [])
      .map((site) => {
        const record = site && typeof site === "object" ? site as Record<string, unknown> : {};
        return {
          id: typeof record.id === "string" ? record.id : "",
          displayName: typeof record.displayName === "string" ? record.displayName : "Webflow site",
          shortName: typeof record.shortName === "string" ? record.shortName : "",
        };
      })
      .filter((site) => site.id);
    if (!sites.length) return json({ error: "That Webflow token has no sites it can access." }, 400);

    if (action === "discover") {
      const described = [] as unknown[];
      for (const site of sites) {
        let collections: { id: string; displayName: string }[] = [];
        try {
          const result = await webflowGet(webflowCollectionsEndpoint(site.id), token);
          collections = (Array.isArray(result.payload.collections) ? result.payload.collections : [])
            .map((collection) => {
              const record = collection && typeof collection === "object" ? collection as Record<string, unknown> : {};
              return {
                id: typeof record.id === "string" ? record.id : "",
                displayName: typeof record.displayName === "string" ? record.displayName : "Collection",
              };
            })
            .filter((collection) => collection.id)
            .slice(0, MAX_COLLECTIONS);
        } catch { collections = []; }

        const evaluated = [] as unknown[];
        for (const collection of collections) {
          try {
            const detail = await webflowGet(webflowCollectionEndpoint(collection.id), token);
            const fields = Array.isArray(detail.payload.fields) ? detail.payload.fields as Parameters<typeof evaluateCollectionFields>[0] : [];
            const evaluation = evaluateCollectionFields(fields);
            evaluated.push(evaluation.compatible
              ? { id: collection.id, displayName: collection.displayName, compatible: true, bodyFields: evaluation.bodyFields }
              : { id: collection.id, displayName: collection.displayName, compatible: false, reason: evaluation.reason });
          } catch {
            evaluated.push({ id: collection.id, displayName: collection.displayName, compatible: false, reason: "Destiny could not read this collection's fields." });
          }
        }
        described.push({ ...site, collections: evaluated });
      }
      return json({ verified: true, sites: described });
    }

    const siteId = typeof body.siteId === "string" ? body.siteId : "";
    const collectionId = typeof body.collectionId === "string" ? body.collectionId : "";
    const site = sites.find((item) => item.id === siteId);
    if (!site) return json({ error: "Choose one of the Webflow sites this token can access." }, 400);
    if (!collectionId) return json({ error: "Choose the Webflow CMS collection for approved articles." }, 400);

    let detail: Awaited<ReturnType<typeof webflowGet>>;
    try { detail = await webflowGet(webflowCollectionEndpoint(collectionId), token); }
    catch { return json({ error: "Destiny could not reach the Webflow API." }, 502); }
    if (!detail.response.ok) return json({ error: "Webflow could not read that collection. Try again." }, 502);
    const collectionName = typeof detail.payload.displayName === "string" ? detail.payload.displayName : "Collection";
    const fields = Array.isArray(detail.payload.fields) ? detail.payload.fields as Parameters<typeof evaluateCollectionFields>[0] : [];
    const evaluation = evaluateCollectionFields(fields);

    let bodyField: string;
    try { bodyField = selectBodyField(evaluation, body.bodyField); }
    catch (cause) { return json({ error: cause instanceof Error ? cause.message : "That collection is not compatible." }, 422); }
    const bodyFieldLabel = evaluation.compatible
      ? (evaluation.bodyFields.find((field) => field.slug === bodyField)?.label ?? bodyField)
      : bodyField;

    const { error } = await context.supabaseAdmin.rpc("store_cms_connection", {
      p_user_id: userId,
      p_website_id: websiteId,
      p_provider: "webflow",
      p_credentials: {
        api_token: token,
        site_id: site.id,
        site_short_name: site.shortName,
        collection_id: collectionId,
        title_field: "name",
        body_field: bodyField,
      },
      p_metadata: {
        site_name: site.displayName,
        site_short_name: site.shortName,
        collection_id: collectionId,
        collection_name: collectionName,
        body_field: bodyField,
        body_field_label: bodyFieldLabel,
      },
    });
    if (error) return json({ error: "Destiny verified Webflow but could not save the secure connection." }, 502);
    return json({ connected: true, siteName: site.displayName, collectionName, bodyFieldLabel });
  }),
};
