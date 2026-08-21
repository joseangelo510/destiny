import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, from } = vi.hoisted(() => ({ getClaims: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims }, from }) }));

const websiteId = "11111111-1111-4111-8111-111111111111";

function validResponse() {
  const sources = Array.from({ length: 4 }, (_, index) => ({ id: `source-${index + 1}`, title: `Source ${index + 1}`, url: `https://example${index + 1}.gov/report`, publisher: `Example ${index + 1}`, publishedAt: "2026-05-01", credibility: "Government data", evergreenReason: "" }));
  const plan = {
    title: "Four current signals",
    subtitle: "A practical visual guide",
    audience: "HR leaders",
    visualDirection: "Warm editorial clarity",
    altText: "Four current signals from cited research.",
    sections: sources.map((source, index) => ({ id: `section-${index + 1}`, eyebrow: `Signal ${index + 1}`, title: `Current signal ${index + 1}`, takeaway: "A useful takeaway grounded in current evidence.", dataPoints: [{ value: `${20 + index}%`, label: "Measured result", context: "The source's measured result.", sourceIds: [source.id] }] })),
    sources,
    article: { title: "Four Current Signals", metaTitle: "Four Current Signals", metaDescription: "See four current signals.", markdown: `# Four Current Signals\n\n${"useful ".repeat(620)}` },
    repurposeCards: sources.map((source, index) => ({ id: `card-${index + 1}`, title: `Signal ${index + 1}`, copy: "One useful, contextual social caption.", recommendedChannel: "LinkedIn", sourceIds: [source.id] })),
  };
  return new Response(JSON.stringify({ output: [
    { type: "web_search_call", action: { sources: sources.map((source) => ({ type: "url", url: source.url, title: source.title })) } },
    { type: "message", content: [{ type: "output_text", text: JSON.stringify(plan), annotations: sources.map((source) => ({ type: "url_citation", url: source.url, title: source.title })) }] },
  ] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("POST /api/content/infographic/research", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: websiteId, business_name: "ClearCheck", products_services: "Screening software", problem_solved: "Clear hiring decisions", ideal_customer: "HR leaders", differentiation: "Plain-language guidance" }, error: null }) }) }) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it("researches the web and returns a citation-verified plan", async () => {
    const fetchMock = vi.fn().mockResolvedValue(validResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/content/infographic/research", { method: "POST", body: JSON.stringify({ websiteId, keyword: "employee background check trends", style: "editorial", specialInstructions: "" }) }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.plan.sections).toHaveLength(4);
    expect(payload.plan.sources).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({ method: "POST" }));
  });

  it("rejects unauthenticated and cross-workspace requests", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: {} } });
    const { POST } = await import("./route");
    const unauthenticated = await POST(new Request("http://localhost/api/content/infographic/research", { method: "POST", body: JSON.stringify({ websiteId, keyword: "test topic", style: "editorial" }) }));
    expect(unauthenticated.status).toBe(401);

    getClaims.mockResolvedValueOnce({ data: { claims: { sub: "user-1" } } });
    from.mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) });
    const inaccessible = await POST(new Request("http://localhost/api/content/infographic/research", { method: "POST", body: JSON.stringify({ websiteId, keyword: "test topic", style: "editorial" }) }));
    expect(inaccessible.status).toBe(404);
  });
});
