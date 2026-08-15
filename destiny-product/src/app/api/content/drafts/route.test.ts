import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, from, selectRows, upsertRows } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  from: vi.fn(),
  selectRows: vi.fn(),
  upsertRows: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims }, from }),
}));

import { GET, PUT } from "./route";

const websiteId = "831740e7-b8f7-4612-8fe4-794219031191";
const auditId = "11111111-1111-4111-8111-111111111111";
const generatedDraft = {
  keyword: "content marketing service",
  title: "How to Choose a Content Marketing Service",
  metaDescription: "Compare content marketing service options.",
  metaDescriptions: ["Compare content marketing service options."],
  body: "# How to Choose a Content Marketing Service\n\nUseful article body.",
  sources: [],
  infographics: [],
  bucketBrigades: [],
  preferences: {
    voice: "punchy_coach",
    format: "seo_article",
    readingEase: "simple_clear",
    specialInstructions: "Use verified sources.",
    addInfographics: true,
  },
  generationStatus: "generated",
  qualityIssues: [],
  optimization: [],
  approved: false,
};

describe("/api/content/drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    from.mockImplementation((table: string) => {
      if (table === "article_drafts") {
        return {
          select: () => ({ eq: () => ({ eq: selectRows }) }),
          upsert: upsertRows,
        };
      }
      if (table === "websites") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { organization_id: "org-1" }, error: null }) }) }) };
      }
      if (table === "audits") {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: auditId }, error: null }) }) }) }) };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    selectRows.mockResolvedValue({ data: [{ draft: generatedDraft }], error: null });
    upsertRows.mockResolvedValue({ error: null });
  });

  it("loads only drafts scoped to the requested website and audit", async () => {
    const response = await GET(new Request(`http://localhost/api/content/drafts?websiteId=${websiteId}&auditId=${auditId}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ drafts: [generatedDraft] });
    expect(from).toHaveBeenCalledWith("article_drafts");
  });

  it("persists generated drafts using the signed-in user and website organization", async () => {
    const response = await PUT(new Request("http://localhost/api/content/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteId, auditId, drafts: [generatedDraft] }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ saved: 1 });
    expect(upsertRows).toHaveBeenCalledWith([
      expect.objectContaining({
        website_id: websiteId,
        audit_id: auditId,
        organization_id: "org-1",
        user_id: "user-1",
        keyword: "content marketing service",
        draft: generatedDraft,
      }),
    ], { onConflict: "website_id,audit_id,keyword" });
  });

  it("rejects an unauthenticated write before touching the database", async () => {
    getClaims.mockResolvedValue({ data: { claims: {} } });
    const response = await PUT(new Request("http://localhost/api/content/drafts", {
      method: "PUT",
      body: JSON.stringify({ websiteId, auditId, drafts: [generatedDraft] }),
    }));

    expect(response.status).toBe(401);
    expect(upsertRows).not.toHaveBeenCalled();
  });

  it("rejects oversized or malformed draft payloads", async () => {
    const response = await PUT(new Request("http://localhost/api/content/drafts", {
      method: "PUT",
      body: JSON.stringify({ websiteId, auditId, drafts: [{ ...generatedDraft, body: "x".repeat(250_001) }] }),
    }));

    expect(response.status).toBe(400);
    expect(upsertRows).not.toHaveBeenCalled();
  });

  it("never downgrades a generated article to a starter draft", async () => {
    const starterDraft = {
      ...generatedDraft,
      title: "Content marketing service",
      body: "",
      generationStatus: "starter",
    };
    selectRows.mockResolvedValue({ data: [{ keyword: generatedDraft.keyword, draft: generatedDraft }], error: null });

    const response = await PUT(new Request("http://localhost/api/content/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteId, auditId, drafts: [starterDraft] }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ saved: 0, protected: 1 });
    expect(upsertRows).not.toHaveBeenCalled();
  });
});
