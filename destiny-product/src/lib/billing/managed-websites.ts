import "server-only";
import { billingSessionClient } from "@/lib/db/billing";
import { parseWebsiteSelection } from "./website-selection";
export async function loadManagedWebsites() {
  try {
    const client = await billingSessionClient();
    if (!await client.getClaims()) return null;
    const { data, error } = await client.invoke({ action: "sites" });
    return error ? null : parseWebsiteSelection(data);
  } catch { return null; }
}
