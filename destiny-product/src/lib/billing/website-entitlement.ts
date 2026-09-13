import "server-only";
import { billingSessionClient } from "@/lib/db/billing";
const unavailable = { canRunPaidWork: false, canManageBilling: false };
export async function loadWebsiteEntitlement(websiteId: string | undefined) {
  if (!websiteId) return unavailable;
  try {
    const client = await billingSessionClient();
    if (!await client.getClaims()) return unavailable;
    const { data, error } = await client.invoke({ action: "website_access", websiteId });
    return error ? unavailable : { canRunPaidWork: data?.canRunPaidWork === true, canManageBilling: data?.canManageBilling === true };
  } catch { return unavailable; }
}
