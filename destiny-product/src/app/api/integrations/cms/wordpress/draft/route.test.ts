import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ functions: { invoke } }),
}));

import { POST } from "./route";

const requestBody = {
  websiteId: "website-1",
  auditId: "audit-1",
  keyword: "junk removal services",
  title: "Junk Removal Services: A Practical Guide",
  body: `# Junk Removal Services\n\n${"A useful paragraph about choosing a reliable local junk removal service. ".repeat(4)}`,
  metaDescription: "Compare local junk removal services and choose the right provider.",
  approved: true,
  generationStatus: "generated",
};

describe("POST /api/integrations/cms/wordpress/draft", () => {
  beforeEach(() => vi.clearAllMocks());

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
