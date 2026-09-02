import { describe, expect, it } from "vitest";
import { safeAgentHref, validateDraftProposal, validateTurnInput } from "./validate";

const websiteId = "11111111-1111-4111-8111-111111111111";

describe("agent input validation", () => {
  it("accepts a scoped turn and trims the message", () => {
    expect(validateTurnInput({ websiteId, message: "  Find my biggest SEO opportunity.  " })).toEqual({
      ok: true,
      value: { websiteId, message: "Find my biggest SEO opportunity.", conversationId: null },
    });
  });

  it("rejects invalid scope, empty input, and oversized input", () => {
    expect(validateTurnInput({ websiteId: "other", message: "hello" }).ok).toBe(false);
    expect(validateTurnInput({ websiteId, message: " " }).ok).toBe(false);
    expect(validateTurnInput({ websiteId, message: "x".repeat(4_001) }).ok).toBe(false);
  });

  it("validates the only authorized proposal shape", () => {
    expect(validateDraftProposal({
      title: "A better technical SEO audit",
      targetKeyword: "technical seo audit",
      angle: "Show what the report should prove.",
      outlineBullets: ["Define the evidence", "Explain the decision"],
    }).ok).toBe(true);
    expect(validateDraftProposal({ title: "Publish now", targetKeyword: "seo", angle: "x", outlineBullets: [] }).ok).toBe(false);
  });

  it("allows only app paths or the selected website", () => {
    expect(safeAgentHref("/app/content", "example.com")).toBe("/app/content");
    expect(safeAgentHref("https://example.com/guide", "example.com")).toBe("https://example.com/guide");
    expect(safeAgentHref("https://evil.example/guide", "example.com")).toBeNull();
    expect(safeAgentHref("javascript:alert(1)", "example.com")).toBeNull();
  });
});
