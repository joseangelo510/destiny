import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readArticleGenerationStream } from "@/lib/content/generation-stream";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));

function wordSequence(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
}

function messageResponse(text: string, stopReason = "end_turn") {
  return new Response(JSON.stringify({
    content: [{ type: "text", text }],
    stop_reason: stopReason,
    usage: { input_tokens: 500, output_tokens: 900 },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("Content Studio article recovery route", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.ANTHROPIC_COPY_MODEL = "claude-opus-4-8";
    createClient.mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1" } } }) },
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: {
            rows: [1, 2, 3].map((index) => ({
              title: `Verified source ${index}`,
              url: `https://example${index}.gov/research`,
              publisher: `example${index}.gov`,
              description: `Verified evidence ${index}`,
            })),
          },
          error: null,
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_COPY_MODEL;
  });

  it("performs one bounded continuation when the first valid response ends at roughly 392 words", async () => {
    const shortArticle = {
      title: "Junk Removal Services: A Practical Guide",
      metaDescription: "Compare junk removal services, pricing considerations, and the right questions to ask before booking.",
      bodyMarkdown: `# Junk Removal Services: A Practical Guide\n\n## Junk Removal Services and Search Intent\n\n${wordSequence(392, "first")} this unfinished thought`,
      bucketBrigades: [],
      sources: [1, 2, 3].map((index) => ({ id: `source-${index}`, title: `Verified source ${index}`, url: `https://example${index}.gov/research`, publisher: `example${index}.gov` })),
      infographics: [],
    };
    const continuation = `## What to Compare Before Booking\n\n${wordSequence(1_750, "continued")} This is the final recommendation.`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(messageResponse(JSON.stringify(shortArticle)))
      .mockResolvedValueOnce(messageResponse(continuation));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: "junk removal services",
        businessName: "98 Junk It",
        problemSolved: "Fast removal of unwanted household and commercial items.",
        idealCustomer: "Homeowners and property managers",
        differentiation: "Local team with transparent service",
        internalPages: [],
        preferences: { voice: "punchy_coach", format: "seo_article", readingEase: "simple_clear", specialInstructions: "", addInfographics: false },
      }),
    }));
    const phases: string[] = [];
    const payload = await readArticleGenerationStream<{
      draft?: { body: string; qualityIssues: Array<{ code: string }> };
      quality?: { recovered?: boolean };
      error?: string;
    }>(response.body, (phase) => phases.push(phase));

    expect(response.status).toBe(200);
    expect(payload.error).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(phases).toEqual(["researching", "writing", "finishing"]);
    expect(payload.draft?.body).not.toContain("unfinished thought");
    expect(payload.draft?.body).toContain("## What to Compare Before Booking");
    expect(payload.quality?.recovered).toBe(true);
    expect(payload.draft?.qualityIssues.some((issue) => issue.code === "incomplete_output")).toBe(false);
  });
});
