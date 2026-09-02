import { describe, expect, it, vi } from "vitest";
import { AGENT_TOOL_NAMES, runAgentTool } from "./registry";

describe("agent tool registry", () => {
  it("exposes exactly the eleven read-only tools and one draft proposal", () => {
    expect(AGENT_TOOL_NAMES).toEqual([
      "get_website_context", "get_search_console_summary", "get_search_console_queries",
      "get_search_console_pages", "get_keyword_verdicts", "list_drafts", "get_draft",
      "get_calendar", "get_distribution_status", "get_progress_summary", "get_evidence",
      "propose_draft",
    ]);
  });

  it("passes verified scope from server context rather than tool input", async () => {
    const query = vi.fn().mockResolvedValue({ summary: "3 tracked keywords", data: [{ keyword: "seo" }] });
    const result = await runAgentTool("get_progress_summary", { websiteId: "attacker-site" }, {
      userId: "user-1", organizationId: "org-1", websiteId: "site-1",
      businessName: "Example Co", domain: "example.com", query,
    });
    expect(query).toHaveBeenCalledWith("get_progress_summary", {}, expect.objectContaining({
      userId: "user-1", organizationId: "org-1", websiteId: "site-1",
    }));
    expect(result).toMatchObject({ ok: true, summary: "3 tracked keywords" });
  });

  it("rejects unknown or mutating tool names", async () => {
    const context = {
      userId: "u", organizationId: "o", websiteId: "w",
      businessName: "Example", domain: "example.com", query: vi.fn(),
    };
    await expect(runAgentTool("publish_to_cms", {}, context)).resolves.toMatchObject({ ok: false });
    expect(context.query).not.toHaveBeenCalled();
  });
});
