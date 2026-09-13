import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function managedSitesResponse(admin: SupabaseClient, ownerId: string, action: "sites" | "select_sites", websiteIds: unknown) {
  if (action === "select_sites" && (!Array.isArray(websiteIds) || websiteIds.length > 10 || new Set(websiteIds).size !== websiteIds.length
    || websiteIds.some(id => typeof id !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)))) {
    return json({ error: "Choose a valid set of websites." }, 400);
  }
  try {
    const { data, error } = action === "sites"
      ? await admin.rpc("billing_website_selection", { p_owner_id: ownerId })
      : await admin.rpc("set_billing_websites", { p_actor_id: ownerId, p_website_ids: websiteIds });
    return error || !data ? json({ error: "Your selection could not be saved or loaded. Check your plan allowance and choose only websites you own." }, action === "sites" ? 503 : 409) : json(data);
  } catch { return json({ error: "Website selection is temporarily unavailable." }, 503); }
}
