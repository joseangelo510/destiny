import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/word-document", () => ({ createDocxFromHtml: vi.fn(), safeDocumentName: vi.fn() }));

import { POST } from "./route";

describe("POST /api/content/word", () => {
  it("blocks a previously approved legacy draft before it can leave through Word export", async () => {
    const response = await POST(new Request("http://localhost/api/content/word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteId: "831740e7-b8f7-4612-8fe4-794219031191",
        draft: {
          keyword: "junk removal services",
          title: "Junk Removal Services: The Complete Practical Guide for Every Homeowner Who Needs Help Today",
          body: `# Junk Removal Services: The Complete Practical Guide for Every Homeowner Who Needs Help Today\n\n${"Useful article content. ".repeat(20)}`,
          generationStatus: "generated",
          approved: true,
        },
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ error: expect.stringMatching(/headline and SEO\/meta title/i) }));
  });
});
