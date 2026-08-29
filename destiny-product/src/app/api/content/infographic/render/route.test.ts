import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InfographicPlan } from "@/lib/content/infographic-generation";

const { getClaims, from, sharpFactory } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  from: vi.fn(),
  sharpFactory: vi.fn(() => {
    const pipeline = { resize: vi.fn(), png: vi.fn(), composite: vi.fn(), toBuffer: vi.fn().mockResolvedValue(Buffer.from("finished-png")) };
    pipeline.resize.mockReturnValue(pipeline); pipeline.png.mockReturnValue(pipeline); pipeline.composite.mockReturnValue(pipeline);
    return pipeline;
  }),
}));
vi.mock("sharp", () => ({ default: sharpFactory }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims }, from }) }));

const websiteId = "11111111-1111-4111-8111-111111111111";
const sources = Array.from({ length: 4 }, (_, index) => ({ id: `source-${index + 1}`, title: `Source ${index + 1}`, url: `https://example${index + 1}.gov/report`, publisher: `Publisher ${index + 1}`, publishedAt: "2026-05-01", credibility: "Primary evidence", evergreenReason: "" }));
const plan: InfographicPlan = {
  title: "Four useful signals", subtitle: "A cited guide", audience: "Business owners", visualDirection: "Warm editorial path", altText: "Four useful signals.",
  sections: sources.map((source, index) => ({ id: `section-${index + 1}`, eyebrow: `Signal ${index + 1}`, title: `Useful signal ${index + 1}`, takeaway: "One grounded takeaway.", dataPoints: [{ value: `${index + 20}%`, label: "Measured result", context: "Source context", sourceIds: [source.id] }] })),
  sources,
  article: { title: "Four Useful Signals", metaTitle: "Four Useful Signals", metaDescription: "A cited guide.", markdown: `# Four Useful Signals\n\n${"useful ".repeat(620)}` },
  repurposeCards: sources.map((source, index) => ({ id: `card-${index + 1}`, title: `Signal ${index + 1}`, copy: "A sourced social post.", recommendedChannel: "LinkedIn", sourceIds: [source.id] })),
};

describe("POST /api/content/infographic/render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: websiteId }, error: null }) }) }) });
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.OPENAI_API_KEY; });

  it("generates only a visual foundation and composites Rebound SEO's exact overlay", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("foundation").toString("base64") }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/content/infographic/render", { method: "POST", body: JSON.stringify({ websiteId, plan, style: "editorial" }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const request = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(request.model).toBe("gpt-image-2");
    expect(request.size).toBe("1024x3072");
    expect(request.prompt).toContain("Include NO words, letters, numbers, statistics");
    expect(sharpFactory).toHaveBeenCalledTimes(2);
  });

  it("explains an exhausted image balance instead of pretending generation worked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "credit_balance_exhausted" } }), { status: 429 })));
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/content/infographic/render", { method: "POST", body: JSON.stringify({ websiteId, plan, style: "editorial" }) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "OpenAI credits need to be added before Rebound SEO can create infographics." });
  });
});
