import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, invoke, websiteMaybeSingle } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  invoke: vi.fn(),
  websiteMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  scopedClient: async () => ({
    getClaims,
    website: () => ({ maybeSingle: websiteMaybeSingle }),
    invokeFunction: invoke,
  }),
}));

import { POST } from "./route";

describe("POST /api/research/keyword-serp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue("user-1");
    websiteMaybeSingle.mockResolvedValue({ data: { id: "site-1" }, error: null });
    invoke.mockResolvedValue({ data: {
      keyword: "youtube ads agency",
      location: "United States",
      checkedAt: "2026-08-27T18:00:00.000Z",
      organic: [], questions: [], related: [],
    }, error: null });
  });

  it("requires an authenticated user", async () => {
    getClaims.mockResolvedValueOnce(null);
    const response = await POST(new Request("http://localhost/api/research/keyword-serp", { method: "POST", body: JSON.stringify({ websiteId: "site-1", keyword: "youtube ads agency" }) }));
    expect(response.status).toBe(401);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("validates the keyword before invoking the provider", async () => {
    const response = await POST(new Request("http://localhost/api/research/keyword-serp", { method: "POST", body: JSON.stringify({ websiteId: "site-1", keyword: "x" }) }));
    expect(response.status).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns a private live snapshot for one explicit keyword", async () => {
    const response = await POST(new Request("http://localhost/api/research/keyword-serp", { method: "POST", body: JSON.stringify({ websiteId: "site-1", keyword: "youtube ads agency", locationName: "United States" }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(invoke).toHaveBeenCalledWith("seo-research", { kind: "keyword_serp", keyword: "youtube ads agency", locationName: "United States" });
  });

  it("requires a selected website scope", async () => {
    const response = await POST(new Request("http://localhost/api/research/keyword-serp", { method: "POST", body: JSON.stringify({ keyword: "youtube ads agency" }) }));
    expect(response.status).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not research for a website outside the signed-in tenant", async () => {
    websiteMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const response = await POST(new Request("http://localhost/api/research/keyword-serp", { method: "POST", body: JSON.stringify({ websiteId: "other-site", keyword: "youtube ads agency" }) }));
    expect(response.status).toBe(404);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("surfaces provider failures without inventing competitors", async () => {
    invoke.mockResolvedValueOnce({ data: { error: "DataForSEO rejected the research request." }, error: { message: "Edge Function returned a non-2xx status code" } });
    const response = await POST(new Request("http://localhost/api/research/keyword-serp", { method: "POST", body: JSON.stringify({ websiteId: "site-1", keyword: "youtube ads agency" }) }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "DataForSEO rejected the research request." });
  });
});
