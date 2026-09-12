import { expect, it, vi } from "vitest";
vi.mock("@supabase/server", () => ({ withSupabase: (_options: unknown, handler: unknown) => handler }));
vi.mock("../../supabase/functions/_shared/billing/website-access.ts", () => ({ websitePaidAccess: async () => null }));
import wordpress from "../../supabase/functions/wordpress-draft/index";
import webflow from "../../supabase/functions/webflow-draft/index";
it.each([["WordPress", wordpress], ["Webflow", webflow]])("stops unpaid %s delivery before credentials or external work", async (_name, worker) => {
  const provider = vi.fn(); vi.stubGlobal("fetch", provider);
  const rpc = vi.fn(() => { throw new Error("Credentials must not be read"); });
  const from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "site-a" } }) }) }) });
  try {
    const response = await worker.fetch(new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ websiteId: "site-a", articleKey: "article-a", title: "Approved article", contentHtml: `<p>${"Approved article content. ".repeat(20)}</p>` }) }), { userClaims: { id: "owner-a" }, supabase: { from }, supabaseAdmin: { rpc } } as never);
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({ code: "BILLING_PAYMENT_REQUIRED", billingUrl: "/account/billing" });
    expect(rpc).not.toHaveBeenCalled(); expect(provider).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
