import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
/** Resolve through the caller's RLS client before any owner billing operation. */
export async function callerWebsiteOwner(client: SupabaseClient, websiteId: string): Promise<string | null> {
  try {
    const { data, error } = await client.from("websites").select("organizations!inner(owner_id)").eq("id", websiteId).maybeSingle();
    const organization = Array.isArray(data?.organizations) ? data.organizations[0] : data?.organizations;
    return !error && typeof organization?.owner_id === "string" ? organization.owner_id : null;
  } catch { return null; }
}
/** Caller site access must already be established; a receipt cannot cross sites or owners. */
export async function matchingWebsiteUsage(admin: SupabaseClient, ownerId: string, websiteId: string, id: string, meter?: string): Promise<boolean> {
  try {
    let query = admin.from("billing_usage").select("id").eq("id", id).eq("owner_id", ownerId).eq("website_id", websiteId);
    if (meter) query = query.eq("meter", meter);
    const { data, error } = await query.maybeSingle();
    return !error && data?.id === id;
  } catch { return false; }
}
