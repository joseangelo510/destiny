import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDraft: vi.fn(),
  loadRequestScope: vi.fn(),
  scopedClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ scopedClient: mocks.scopedClient }));
vi.mock("@/lib/drafts/createDraft", () => ({ createDraft: mocks.createDraft }));
vi.mock("@/lib/agent/store", () => ({ loadRequestScope: mocks.loadRequestScope }));

const websiteId = "11111111-1111-4111-8111-111111111111";
const proposalId = "22222222-2222-4222-8222-222222222222";
const proposal = {
  id: proposalId,
  status: "proposed",
  payload: {
    title: "Technical SEO audit guide",
    targetKeyword: "technical seo audit",
    angle: "Evidence first",
    outlineBullets: ["Proof", "Decision"],
  },
};

function query(data: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "order", "limit"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  return builder;
}

describe("/api/agent/proposals/[proposalId]/decide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const updateResult = query({ id: proposalId });
    const client = {
      select: vi.fn((table: string) => query(table === "agent_proposals" ? proposal : { id: "audit-1" })),
      update: vi.fn(() => ({ select: vi.fn(() => updateResult) })),
    };
    mocks.scopedClient.mockResolvedValue({ getClaims: async () => "user-1" });
    mocks.loadRequestScope.mockResolvedValue({
      client, userId: "user-1", organizationId: "org-1", websiteId,
      businessName: "Example", domain: "example.com",
    });
    mocks.createDraft.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333", existed: false });
  });

  it("creates only the approved starter draft and records the decision", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/decide", {
      method: "POST",
      body: JSON.stringify({ action: "approve", websiteId }),
    }), { params: Promise.resolve({ proposalId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "approved", artifactId: "33333333-3333-4333-8333-333333333333" });
    expect(mocks.createDraft).toHaveBeenCalledOnce();
    const scope = await mocks.loadRequestScope.mock.results[0]?.value;
    expect(scope.client.update).toHaveBeenCalledWith("agent_proposals", expect.objectContaining({
      status: "approved", decided_by: "user-1",
    }), { id: proposalId, status: "proposed" });
  });

  it("records a rejection without creating any artifact", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/decide", {
      method: "POST",
      body: JSON.stringify({ action: "reject", websiteId }),
    }), { params: Promise.resolve({ proposalId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "rejected" });
    expect(mocks.createDraft).not.toHaveBeenCalled();
  });

  it("fails closed when the selected website is outside the signed-in scope", async () => {
    mocks.loadRequestScope.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/decide", {
      method: "POST",
      body: JSON.stringify({ action: "approve", websiteId }),
    }), { params: Promise.resolve({ proposalId }) });
    expect(response.status).toBe(404);
    expect(mocks.createDraft).not.toHaveBeenCalled();
  });
});
