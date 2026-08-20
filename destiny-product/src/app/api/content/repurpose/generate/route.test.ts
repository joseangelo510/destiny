import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { getClaims, from } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims }, from }),
}));

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

import { POST } from "./route";
import {
  REPURPOSE_ENCRYPTION_VERSION,
  encryptRepurposeSourceText,
} from "@/lib/content/repurpose-crypto";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const websiteId = "831740e7-b8f7-4612-8fe4-794219031191";
const sourceId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const orgId = "org-00000000-0000-4000-8000-000000000001";
const APPROVED_KEYWORD = "content marketing service";

const STORED_EXTRACTED_TEXT =
  "This is stored extracted text from the database. ".repeat(30);
const SESSION_SECRET = "test-session-secret-for-repurpose-encryption";

const MOCK_WEBSITE = {
  id: websiteId,
  organization_id: orgId,
  business_name: "Acme Corp",
  products_services: "Content marketing tools",
  ideal_customer: "Founders and marketers",
  differentiation: "Fast and reliable",
};

const MOCK_SOURCE = {
  id: sourceId,
  website_id: websiteId,
  organization_id: orgId,
  source_name: "My Document",
  source_url: null,
  source_kind: "file",
  extracted_text_ciphertext: encryptRepurposeSourceText(
    STORED_EXTRACTED_TEXT,
    SESSION_SECRET,
  ),
  encryption_version: REPURPOSE_ENCRYPTION_VERSION,
  generation_attempts: 0,
  status: "ready",
};

const MOCK_DRAFT_RESPONSE = {
  content: [
    {
      type: "text",
      text: JSON.stringify({
        title: "Generated Title",
        bodyMarkdown: "# Generated\n\nBody content here.",
        excerpt: "A concise excerpt.",
      }),
    },
  ],
  stop_reason: "end_turn",
};

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------

type TableMockOptions = {
  website?: unknown;
  websiteError?: unknown;
  keyword?: unknown;
  keywordError?: unknown;
  source?: unknown;
  sourceError?: unknown;
  updateResult?: { error: null | { message: string } };
};

function setupSupabaseMock(opts: TableMockOptions = {}) {
  const {
    website = MOCK_WEBSITE,
    websiteError = null,
    keyword = { keyword: APPROVED_KEYWORD },
    keywordError = null,
    source = MOCK_SOURCE,
    sourceError = null,
    updateResult = { error: null },
  } = opts;

  from.mockImplementation((table: string) => {
    if (table === "websites") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: website, error: websiteError }),
          }),
        }),
      };
    }
    if (table === "keyword_preferences") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: keyword, error: keywordError }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "repurpose_sources") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: source, error: sourceError }),
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: async () => updateResult,
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/content/repurpose/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
  process.env.ANTHROPIC_COPY_MODEL = "claude-opus-4-8";
  process.env.SESSION_SECRET = SESSION_SECRET;

  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });

  setupSupabaseMock();

  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => MOCK_DRAFT_RESPONSE,
  });
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe("POST /api/content/repurpose/generate – authentication", () => {
  it("rejects unauthenticated requests before any database work", async () => {
    getClaims.mockResolvedValue({ data: { claims: {} } });

    const response = await POST(
      buildRequest({ websiteId, sourceId, output: "email" }),
    );

    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("POST /api/content/repurpose/generate – validation", () => {
  it("rejects invalid websiteId UUID", async () => {
    const response = await POST(
      buildRequest({ websiteId: "bad", sourceId, output: "email" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/websiteId/i);
  });

  it("rejects invalid sourceId UUID", async () => {
    const response = await POST(
      buildRequest({ websiteId, sourceId: "bad", output: "email" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/sourceId/i);
  });

  it("rejects an invalid output code", async () => {
    const response = await POST(
      buildRequest({ websiteId, sourceId, output: "magazine_spread" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("INVALID_OUTPUT");
  });

  it("accepts all six valid output codes", async () => {
    for (const output of [
      "seo_blog_article",
      "linkedin_post",
      "x_thread",
      "email",
      "faq",
      "outline",
    ]) {
      const response = await POST(buildRequest({ websiteId, sourceId, output }));
      // May fail for other reasons (provider) but must NOT be 400 on output
      expect(response.status).not.toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// Website / source unavailability
// ---------------------------------------------------------------------------

describe("POST /api/content/repurpose/generate – resource access", () => {
  it("returns 404 when website is not accessible", async () => {
    setupSupabaseMock({ website: null, websiteError: null });

    const response = await POST(
      buildRequest({ websiteId, sourceId, output: "email" }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatch(/website/i);
  });

  it("returns 404 when source does not belong to the requested website", async () => {
    setupSupabaseMock({ source: null, sourceError: null });

    const response = await POST(
      buildRequest({ websiteId, sourceId, output: "email" }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatch(/source/i);
  });

  it("denies cross-site source: source has different organization_id than website", async () => {
    setupSupabaseMock({
      source: { ...MOCK_SOURCE, organization_id: "different-org" },
    });

    const response = await POST(
      buildRequest({ websiteId, sourceId, output: "email" }),
    );
    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Keyword validation
// ---------------------------------------------------------------------------

describe("POST /api/content/repurpose/generate – keyword validation", () => {
  it("rejects a keyword that is not in approved keyword_preferences", async () => {
    setupSupabaseMock({ keyword: null, keywordError: null });

    const response = await POST(
      buildRequest({
        websiteId,
        sourceId,
        output: "email",
        targetKeyword: "unapproved keyword",
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("UNAPPROVED_KEYWORD");
  });

  it("allows generation without a keyword (no keyword validation)", async () => {
    const response = await POST(
      buildRequest({ websiteId, sourceId, output: "email" }),
    );
    expect(response.status).toBe(200);
    // keyword_preferences should NOT have been queried
    const kpCalls = from.mock.calls.filter((c) => c[0] === "keyword_preferences");
    expect(kpCalls).toHaveLength(0);
  });

  it("allows generation with an approved keyword", async () => {
    const response = await POST(
      buildRequest({
        websiteId,
        sourceId,
        output: "email",
        targetKeyword: APPROVED_KEYWORD,
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.draft).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Provider behaviour
// ---------------------------------------------------------------------------

describe("POST /api/content/repurpose/generate – provider", () => {
  it("decrypts the persisted source for the provider without accepting client text", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    mockFetch.mockImplementation(async (_url: string, init: { body: string }) => {
      capturedBody = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => MOCK_DRAFT_RESPONSE };
    });

    await POST(
      buildRequest({ websiteId, sourceId, output: "email" }),
    );

    expect(capturedBody).not.toBeNull();
    const promptStr = JSON.stringify(capturedBody);
    // The stored extracted text should appear in the prompt
    expect(promptStr).toContain(STORED_EXTRACTED_TEXT.slice(0, 50));
    // Client should never be able to inject text — no client field goes to provider
  });

  it("fails closed before provider access when persisted ciphertext is invalid", async () => {
    setupSupabaseMock({
      source: {
        ...MOCK_SOURCE,
        extracted_text_ciphertext: "aes-256-gcm-v1.invalid.invalid.invalid",
      },
    });

    const response = await POST(
      buildRequest({ websiteId, sourceId, output: "email" }),
    );

    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("SOURCE_DECRYPTION_FAILED");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("updates status to writing and increments attempts before provider call", async () => {
    const updateCalls: unknown[] = [];
    from.mockImplementation((table: string) => {
      if (table === "websites") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: MOCK_WEBSITE, error: null }) }) }) };
      }
      if (table === "keyword_preferences") {
        return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) };
      }
      if (table === "repurpose_sources") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: MOCK_SOURCE, error: null }),
              }),
            }),
          }),
          update: (data: unknown) => {
            updateCalls.push(data);
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected: ${table}`);
    });

    await POST(buildRequest({ websiteId, sourceId, output: "email" }));

    // First update should set status=writing
    const firstUpdate = updateCalls[0] as Record<string, unknown>;
    expect(firstUpdate.status).toBe("writing");
    expect(firstUpdate.generation_attempts).toBe(1);
  });

  it("persists status=ready and clears errors on success", async () => {
    const updateCalls: unknown[] = [];
    from.mockImplementation((table: string) => {
      if (table === "websites") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: MOCK_WEBSITE, error: null }) }) }) };
      }
      if (table === "keyword_preferences") {
        return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) };
      }
      if (table === "repurpose_sources") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: MOCK_SOURCE, error: null }),
              }),
            }),
          }),
          update: (data: unknown) => {
            updateCalls.push(data);
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected: ${table}`);
    });

    const response = await POST(buildRequest({ websiteId, sourceId, output: "email" }));
    expect(response.status).toBe(200);

    // Last update should set status=ready
    const lastUpdate = updateCalls[updateCalls.length - 1] as Record<string, unknown>;
    expect(lastUpdate.status).toBe("ready");
    expect(lastUpdate.last_error_code).toBeNull();
    expect(lastUpdate.last_error_message).toBeNull();
    expect(lastUpdate.draft_title).toBe("Generated Title");
    expect(lastUpdate.draft_body).toBe("# Generated\n\nBody content here.");
  });

  it("persists status=failed with error info on provider failure but retains source for retry", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "Internal provider error" } }),
    });

    const updateCalls: unknown[] = [];
    from.mockImplementation((table: string) => {
      if (table === "websites") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: MOCK_WEBSITE, error: null }) }) }) };
      }
      if (table === "keyword_preferences") {
        return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) };
      }
      if (table === "repurpose_sources") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: MOCK_SOURCE, error: null }),
              }),
            }),
          }),
          update: (data: unknown) => {
            updateCalls.push(data);
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected: ${table}`);
    });

    const response = await POST(buildRequest({ websiteId, sourceId, output: "email" }));
    expect(response.status).toBe(502);

    const lastUpdate = updateCalls[updateCalls.length - 1] as Record<string, unknown>;
    expect(lastUpdate.status).toBe("failed");
    expect(lastUpdate.last_error_code).toBe("ANTHROPIC_ERROR");
    // Encrypted source material is NOT modified (source is reusable).
    expect("extracted_text_ciphertext" in lastUpdate).toBe(false);
  });

  it("persists status=failed on parse error but source remains reusable", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "text", text: "not valid json at all!" }],
        stop_reason: "end_turn",
      }),
    });

    const updateCalls: unknown[] = [];
    from.mockImplementation((table: string) => {
      if (table === "websites") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: MOCK_WEBSITE, error: null }) }) }) };
      }
      if (table === "keyword_preferences") {
        return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) };
      }
      if (table === "repurpose_sources") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: MOCK_SOURCE, error: null }),
              }),
            }),
          }),
          update: (data: unknown) => {
            updateCalls.push(data);
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected: ${table}`);
    });

    const response = await POST(buildRequest({ websiteId, sourceId, output: "email" }));
    expect(response.status).toBe(502);

    const lastUpdate = updateCalls[updateCalls.length - 1] as Record<string, unknown>;
    expect(lastUpdate.status).toBe("failed");
    expect(lastUpdate.last_error_code).toBe("PARSE_ERROR");
  });

  it("retries reuse the same source row and increment attempts without re-ingesting", async () => {
    // First attempt has generation_attempts=2 (already tried twice)
    const sourceWithAttempts = { ...MOCK_SOURCE, generation_attempts: 2 };
    setupSupabaseMock({ source: sourceWithAttempts });

    let capturedWritingUpdate: Record<string, unknown> | null = null;
    from.mockImplementation((table: string) => {
      if (table === "websites") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: MOCK_WEBSITE, error: null }) }) }) };
      }
      if (table === "keyword_preferences") {
        return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) };
      }
      if (table === "repurpose_sources") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: sourceWithAttempts,
                  error: null,
                }),
              }),
            }),
          }),
          update: (data: unknown) => {
            if (!capturedWritingUpdate) {
              capturedWritingUpdate = data as Record<string, unknown>;
            }
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected: ${table}`);
    });

    const response = await POST(buildRequest({ websiteId, sourceId, output: "email" }));
    expect(response.status).toBe(200);

    // attempts should be incremented from 2 to 3
    expect(capturedWritingUpdate?.generation_attempts).toBe(3);

    const body = await response.json();
    expect(body.attempts).toBe(3);
    expect(body.sourceId).toBe(sourceId);
  });

  it("returns the sourceId, draft, attribution and attempts on success", async () => {
    const response = await POST(buildRequest({ websiteId, sourceId, output: "email" }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.sourceId).toBe(sourceId);
    expect(body.draft).toMatchObject({
      output: "email",
      title: "Generated Title",
      bodyMarkdown: expect.stringContaining("Generated"),
      excerpt: "A concise excerpt.",
    });
    expect(body.attribution).toBeDefined();
    expect(body.attempts).toBe(1);
  });

  it("response never includes extracted_text", async () => {
    const response = await POST(buildRequest({ websiteId, sourceId, output: "faq" }));
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("extracted_text");
    expect(JSON.stringify(body)).not.toContain("extractedText");
    expect(JSON.stringify(body)).not.toContain(STORED_EXTRACTED_TEXT.slice(0, 20));
  });

  it("returns 503 when ANTHROPIC_API_KEY is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await POST(buildRequest({ websiteId, sourceId, output: "email" }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("ANTHROPIC_NOT_CONFIGURED");
  });

  it("returns 503 when source decryption is not configured", async () => {
    delete process.env.SESSION_SECRET;

    const response = await POST(buildRequest({ websiteId, sourceId, output: "email" }));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("SOURCE_ENCRYPTION_NOT_CONFIGURED");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
