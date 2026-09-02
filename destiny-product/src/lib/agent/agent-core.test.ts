import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentLoop } from "./loop";
import { callAnthropic } from "./provider";
import { buildAgentSystemPrompt } from "./prompt";
import { allowAgentTurn, resetAgentRateLimitsForTests } from "./rate-limit";

describe("Rebound Agent core", () => {
  beforeEach(() => resetAgentRateLimitsForTests());

  it("builds a site-scoped prompt that treats evidence as untrusted", () => {
    const prompt = buildAgentSystemPrompt({ businessName: "Example Co", domain: "example.com" });
    expect(prompt).toContain("Example Co");
    expect(prompt).toContain("example.com");
    expect(prompt).toContain("untrusted evidence");
    expect(prompt).toContain("never publish");
  });

  it("enforces both website and user hourly limits", () => {
    for (let index = 0; index < 30; index += 1) {
      expect(allowAgentTurn({ userId: "u1", websiteId: "w1", now: 1_000 })).toEqual({ ok: true });
    }
    expect(allowAgentTurn({ userId: "u1", websiteId: "w1", now: 1_000 })).toMatchObject({ ok: false });
    expect(allowAgentTurn({ userId: "u1", websiteId: "w2", now: 1_000 })).toEqual({ ok: true });
  });

  it("calls Anthropic with the existing Messages API contract", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: "Here is the opportunity." }],
      stop_reason: "end_turn",
      usage: { input_tokens: 12, output_tokens: 8 },
    }), { status: 200 }));
    const result = await callAnthropic({
      apiKey: "secret",
      model: "claude-test",
      messages: [{ role: "user", content: "Help" }],
      system: "Stay scoped.",
      tools: [],
      fetchImpl,
    });
    expect(result.text).toBe("Here is the opportunity.");
    expect(fetchImpl).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-api-key": "secret" }),
    }));
  });

  it("streams visible work before the final answer", async () => {
    const events: string[] = [];
    const provider = vi.fn()
      .mockResolvedValueOnce({
        text: "",
        stopReason: "tool_use",
        usage: { inputTokens: 5, outputTokens: 5 },
        blocks: [{ type: "tool_use", id: "tool-1", name: "get_website_context", input: {} }],
      })
      .mockResolvedValueOnce({
        text: "Your strongest move is to improve the saved service page.",
        stopReason: "end_turn",
        usage: { inputTokens: 5, outputTokens: 10 },
        blocks: [{ type: "text", text: "Your strongest move is to improve the saved service page." }],
      });
    const result = await runAgentLoop({
      context: {
        userId: "u1", organizationId: "o1", websiteId: "w1",
        businessName: "Example Co", domain: "example.com",
        query: vi.fn().mockResolvedValue({ data: { domain: "example.com" }, summary: "Website loaded" }),
      },
      history: [{ role: "user", content: "What should I do?" }],
      provider,
      onEvent: (event) => events.push(event.type),
    });
    expect(result.text).toContain("strongest move");
    expect(events).toEqual(["status", "tool_start", "tool_end", "text", "done"]);
  });
});
