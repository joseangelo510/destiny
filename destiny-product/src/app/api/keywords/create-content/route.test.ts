import { beforeEach, describe, expect, it, vi } from "vitest";
const { getClaims, select, website, scoped, createDraft } = vi.hoisted(() => ({ getClaims: vi.fn(), select: vi.fn(), website: vi.fn(), scoped: vi.fn(), createDraft: vi.fn() }));
vi.mock("@/lib/db", () => ({ scopedClient: scoped }));
vi.mock("@/lib/drafts/createDraft", () => ({ createDraft }));
import { POST } from "./route";
const websiteId = "831740e7-b8f7-4612-8fe4-794219031191";
const auditId = "11111111-1111-4111-8111-111111111111";
const request = (extra = {}) => new Request("http://localhost/api/keywords/create-content", { method: "POST", body: JSON.stringify({ websiteId, auditId, keyword: "youtube marketing strategy", ...extra }) });
const query = (data: unknown) => ({ eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) });

describe("keyword to saved draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue("user-1");
    scoped.mockResolvedValue({ getClaims, select, website });
    website.mockReturnValue(query({ organization_id: "org-1", ideal_customer: "B2B SaaS teams" }));
    select.mockImplementation((table: string) => query(table === "audits" ? { id: auditId, requested_by: "user-1" } : { keyword: "youtube marketing strategy", decision: "approved", search_volume: 100 }));
    createDraft.mockResolvedValue({ id: "draft-1", existed: false });
  });
  it("uses only the requested website and opens the selected saved keyword in Content Studio", async () => {
    const response = await POST(request({ pageType: "Blog guide / FAQ" }));
    expect(response.status).toBe(200);
    expect(scoped).toHaveBeenCalledWith(websiteId);
    expect(createDraft).toHaveBeenCalledWith(expect.anything(), { userId: "user-1", organizationId: "org-1", websiteId, auditId }, expect.objectContaining({ targetKeyword: "youtube marketing strategy", angle: expect.stringContaining("Blog guide / FAQ") }));
    expect((await response.json()).url).toContain(`site=${websiteId}&keyword=youtube%20marketing%20strategy`);
  });
  it("rejects an unavailable audit without creating a draft", async () => {
    select.mockReturnValue(query(null));
    expect((await POST(request())).status).toBe(404);
    expect(createDraft).not.toHaveBeenCalled();
  });
  it("requires a saved approval for a measured keyword", async () => {
    select.mockImplementation((table: string) => query(table === "audits" ? { id: auditId, requested_by: "user-1" } : { decision: "declined", search_volume: 100 }));
    expect((await POST(request())).status).toBe(409);
    expect(createDraft).not.toHaveBeenCalled();
  });
  it("does not accept unauthenticated requests or invented metrics", async () => {
    getClaims.mockResolvedValue(null);
    expect((await POST(request({ volume: 1000 }))).status).toBe(401);
    expect(createDraft).not.toHaveBeenCalled();
  });
  it("opens an existing draft through the idempotent shared draft helper", async () => {
    createDraft.mockResolvedValue({ id: "existing-draft", existed: true });
    const response = await POST(request());
    expect((await response.json()).existed).toBe(true);
  });
});
