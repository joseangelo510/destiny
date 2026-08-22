import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, invoke } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims },
    functions: { invoke },
  }),
}));

import { POST } from "./route";

const requestBody = {
  websiteId: "website-1",
  auditId: "audit-1",
  keyword: "junk removal services",
  title: "Junk Removal Services: A Practical Guide",
  metaTitle: "Junk Removal Services: A Practical Guide",
  titleCandidates: ["numbered", "how_to", "second_person", "question", "descriptive", "benefit"].map((format, index) => ({ format, headline: `Candidate ${index + 1}`, metaTitle: `Junk Removal Services Candidate ${index + 1} Guide`, score: 90 - index, rationale: "Accurate." })),
  body: `# Junk Removal Services: A Practical Guide\n\n${"A useful paragraph about choosing a reliable local junk removal service. ".repeat(4)}`,
  metaDescription: "Compare local junk removal services and choose the right provider.",
  approved: true,
  generationStatus: "generated",
};

describe("POST /api/integrations/cms/wordpress/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  });

  it("returns 401 before invoking WordPress for an anonymous draft request", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const response = await POST(new Request("http://localhost/api/integrations/cms/wordpress/draft", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in again to continue." });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sends only a normalized approved draft to the authenticated Edge Function", async () => {
    invoke.mockResolvedValue({ data: { delivered: true, remoteEditUrl: "https://example.com/wp-admin/post.php?post=42&action=edit" }, error: null });
    const response = await POST(new Request("http://localhost/api/integrations/cms/wordpress/draft", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }));

    expect(response.status).toBe(200);
    expect(invoke).toHaveBeenCalledWith("wordpress-draft", { body: expect.objectContaining({
      websiteId: "website-1",
      articleKey: "audit-1:junk removal services",
      contentHtml: expect.stringContaining("<p>A useful paragraph"),
    }) });
    expect(JSON.stringify(invoke.mock.calls[0])).not.toContain("applicationPassword");
  });

  it("does not call WordPress for an unapproved article", async () => {
    const response = await POST(new Request("http://localhost/api/integrations/cms/wordpress/draft", {
      method: "POST",
      body: JSON.stringify({ ...requestBody, approved: false }),
    }));

    expect(response.status).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
  });
});
