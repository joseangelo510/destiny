import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, from, rpc, insert } = vi.hoisted(() => ({
  getClaims: vi.fn(), from: vi.fn(), rpc: vi.fn(), insert: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims }, from, rpc }) }));

import { POST } from "./route";

const websiteId = "11111111-1111-4111-8111-111111111111";
const auditId = "22222222-2222-4222-8222-222222222222";
const draftId = "33333333-3333-4333-8333-333333333333";

function request() {
  return new Request("http://localhost/api/content/publishing-plan", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ websiteId, draftId, title: "Tenant screening guide", focusKeyword: "tenant screening", contentType: "approved_draft", scheduledFor: "2026-10-01T16:00:00.000Z" }),
  });
}

function query(data: unknown) {
  const builder = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), single: vi.fn(),
  };
  for (const name of ["select", "eq", "order", "limit"] as const) builder[name].mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({ data, error: null });
  builder.single.mockResolvedValue({ data, error: null });
  return builder;
}

describe("approved-draft Calendar publication guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    from.mockImplementation((table: string) => {
      if (table === "publishing_plans") return query({ id: "plan-1", organization_id: "org-1", website_id: websiteId, audit_id: auditId });
      if (table === "article_drafts") return query({ id: draftId, audit_id: auditId, keyword: "tenant screening", draft: { title: "Tenant screening guide", approved: true } });
      if (table === "publishing_schedule_items") return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) })) })) })) })),
        insert,
      };
      throw new Error(`Unexpected table ${table}`);
    });
    insert.mockReturnValue({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "slot-1" }, error: null }) })) });
  });

  it("rejects scheduling the exact WordPress-published draft without inserting a slot", async () => {
    rpc.mockResolvedValue({ data: [{ provider: "wordpress", articleKey: `${auditId}:tenant screening`, publicationStatus: "verification_failed", remoteStatus: "publish" }], error: null });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("already published");
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed when WordPress state cannot be checked", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "temporary outage" } });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(insert).not.toHaveBeenCalled();
  });
});
