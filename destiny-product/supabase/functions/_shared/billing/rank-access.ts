import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
import { websitePaidAccess } from "./website-access.ts";
export async function rankTrackingAccess(admin: SupabaseClient, websiteId: string, now = Date.now()) {
  const access = await websitePaidAccess(admin, websiteId, now);
  return access ? { ownerId: access.ownerId, limit: access.limits.trackedTargets, trial: access.trial } : null;
}
