import { beforeEach, expect, it, vi } from "vitest";
const { reserveContentWork, finishContentWork, saved, provider } = vi.hoisted(() => ({ reserveContentWork: vi.fn(), finishContentWork: vi.fn(), saved: { current: false }, provider: vi.fn() }));
vi.mock("@/lib/seo/reoptimization-document", async (original) => ({ ...await original<Record<string, unknown>>(), fetchReoptimizationPage: provider }));
vi.mock("@/lib/billing/worker", () => ({ reserveContentWork, finishContentWork }));
vi.mock("@/lib/seo/research", () => ({ getResearchClient: () => ({ reoptimizationResearch: provider }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getClaims: async () => ({ data: { claims: { sub: "owner-a" } } }) },
  from: (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const name of ["select", "eq"]) builder[name] = () => builder;
    builder.maybeSingle = async () => ({ data: table === "audits" ? { id: "audit-a", website_id: "site-a", requested_by: "owner-a" }
      : table === "websites" ? { id: "site-a", url: "https://example.com", organization_id: "org-a" }
      : table === "reoptimization_documents" ? (saved.current ? { id: "document-a", manifest: { version: 4 } } : null)
      : table === "audit_metrics" ? { raw_provider_payload: { providerResult: { keywords: [{ keyword: "seo", url: "https://example.com/seo" }] } } } : null });
    return builder;
  },
}) }));
import { POST } from "../../src/app/api/reoptimization-documents/route";
beforeEach(() => { vi.clearAllMocks(); saved.current = false; reserveContentWork.mockResolvedValue({ response: Response.json({ code: "BILLING_LIMIT_REACHED" }, { status: 402 }) }); });
const request = () => new Request("https://example.invalid", { method: "POST", body: JSON.stringify({ auditId: "audit-a", keyword: "seo" }) });
it("blocks new research and writing when the allowance is exhausted", async () => {
  process.env.ANTHROPIC_API_KEY = "fixture";
  try { expect((await POST(request())).status).toBe(402); expect(provider).not.toHaveBeenCalled(); }
  finally { delete process.env.ANTHROPIC_API_KEY; }
});
it("reuses saved documents without reserving or charging another unit", async () => {
  saved.current = true;
  const response = await POST(request());
  expect(response.status).toBe(200); expect((await response.json()).reused).toBe(true);
  expect(reserveContentWork).not.toHaveBeenCalled(); expect(provider).not.toHaveBeenCalled();
});
