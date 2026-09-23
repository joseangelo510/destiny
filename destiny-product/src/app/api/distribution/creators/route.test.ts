import { describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/billing/failure-response", () => ({ billingFailureResponse: async () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getClaims: async () => ({ data: { claims: { sub: "user-one" } } }) },
  from: (table: string) => table === "websites"
    ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "site-one", normalized_domain: "clearcheck.app", plan_tier: "super_growth" } }) }) }) }
    : { select: () => ({ eq: async () => ({ data: [] }) }) },
  functions: { invoke: async () => ({ data: { rows: fixture.rows, updatedAt: "2026-09-23T18:49:12Z" }, error: null }) },
}) }));
import { POST } from "./route";

describe("creator refresh response", () => {
  it("normalizes provider rows with the same evidence classification as saved results", async () => {
    fixture.rows = [
      { domain: "paychex.com", title: "Employment screening services", url: "https://paychex.com/hiring/employment-screening", matchedTopic: "background checks", platform: "Independent blog" },
      { domain: "medium.com", title: "Hiring checks explained", url: "https://medium.com/@hrwriter/hiring-checks-explained-123", matchedTopic: "background checks", platform: "Medium" },
    ];
    const response = await POST(new Request("https://app.reboundseo.com/api/distribution/creators", { method: "POST", body: JSON.stringify({ websiteId: "site-one", topics: ["background checks"] }) }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.rows).toEqual([
      expect.objectContaining({ domain: "paychex.com", sourceKind: "commercial", platform: "Vendor or directory" }),
      expect.objectContaining({ domain: "medium.com", sourceKind: "candidate", platform: "Medium" }),
    ]);
  });
});
