import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
import { websitePaidAccess } from "./website-access.ts";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function websiteEntitlementResponse(viewerId: string, websiteId: unknown, viewer: SupabaseClient, admin: SupabaseClient) {
  if (typeof websiteId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(websiteId)) return json({ error: "Choose a valid website." }, 400);
  try {
    const { data: website, error } = await viewer.from("websites").select("id,organizations!inner(owner_id)").eq("id", websiteId).maybeSingle();
    const organization = Array.isArray(website?.organizations) ? website.organizations[0] : website?.organizations;
    const ownerId = organization?.owner_id;
    if (error || !website || typeof ownerId !== "string") return json({ error: "You do not have access to that website." }, 403);
    const access = await websitePaidAccess(admin, websiteId);
    return json({ canRunPaidWork: access?.ownerId === ownerId, canManageBilling: ownerId === viewerId });
  } catch {
    return json({ error: "Website subscription access is temporarily unavailable." }, 503);
  }
}
