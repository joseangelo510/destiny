import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allowAgentTurn: vi.fn(),
  ensureConversation: vi.fn(),
  insertUserMessage: vi.fn(),
  loadProviderHistory: vi.fn(),
  loadRequestScope: vi.fn(),
  persistAssistantTurn: vi.fn(),
  runAgentLoop: vi.fn(),
  scopedClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ scopedClient: mocks.scopedClient }));
vi.mock("@/lib/agent/rate-limit", () => ({ allowAgentTurn: mocks.allowAgentTurn }));
vi.mock("@/lib/agent/store", () => ({
  ensureConversation: mocks.ensureConversation,
  insertUserMessage: mocks.insertUserMessage,
  loadProviderHistory: mocks.loadProviderHistory,
  loadRequestScope: mocks.loadRequestScope,
  persistAssistantTurn: mocks.persistAssistantTurn,
}));
vi.mock("@/lib/agent/loop", () => ({ runAgentLoop: mocks.runAgentLoop }));
vi.mock("@/lib/agent/tools/data-query", () => ({ createAgentToolQuery: () => vi.fn() }));
vi.mock("@/lib/content/article-generation", () => ({ DEFAULT_COPY_MODEL: "claude-test" }));

const websiteId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";

describe("/api/agent/turn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
    mocks.scopedClient.mockResolvedValue({ getClaims: async () => "user-1" });
    mocks.allowAgentTurn.mockReturnValue({ ok: true });
    mocks.loadRequestScope.mockResolvedValue({
      client: {}, userId: "user-1", organizationId: "org-1", websiteId,
      businessName: "Example", domain: "example.com",
    });
    mocks.ensureConversation.mockResolvedValue(conversationId);
    mocks.loadProviderHistory.mockResolvedValue([{ role: "user", content: "Help" }]);
    mocks.persistAssistantTurn.mockResolvedValue([{
      id: "33333333-3333-4333-8333-333333333333",
      status: "proposed",
      payload: { title: "Audit page", targetKeyword: "seo audit", angle: "Evidence", outlineBullets: ["Proof", "Decision"] },
    }]);
    mocks.runAgentLoop.mockImplementation(async ({ onEvent }: { onEvent: (event: Record<string, unknown>) => void }) => {
      onEvent({ type: "status", message: "Reading saved SEO evidence" });
      onEvent({ type: "text", text: "Start with the audit page." });
      return { text: "Start with the audit page.", proposals: [{ title: "Audit page" }], usage: { inputTokens: 5, outputTokens: 8 } };
    });
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_COPY_MODEL;
  });

  it("rejects invalid scope before authentication or provider work", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/agent/turn", {
      method: "POST",
      body: JSON.stringify({ websiteId: "attacker", message: "Help" }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.scopedClient).not.toHaveBeenCalled();
    expect(mocks.runAgentLoop).not.toHaveBeenCalled();
  });

  it("streams typed work, persisted proposal, and completion events", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/agent/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ websiteId, message: "What should I improve?" }),
    }));
    const stream = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(stream).toContain('event: status');
    expect(stream).toContain('event: text');
    expect(stream).toContain('event: proposal');
    expect(stream).toContain(`"conversationId":"${conversationId}"`);
    expect(mocks.insertUserMessage).toHaveBeenCalledOnce();
    expect(mocks.persistAssistantTurn).toHaveBeenCalledWith(expect.objectContaining({ conversationId }));
  });

  it("returns an explicit rate-limited state before creating a conversation", async () => {
    mocks.allowAgentTurn.mockReturnValue({ ok: false, retryAfterSeconds: 90 });
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/agent/turn", {
      method: "POST",
      body: JSON.stringify({ websiteId, message: "Help" }),
    }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("90");
    expect(mocks.ensureConversation).not.toHaveBeenCalled();
  });
});
