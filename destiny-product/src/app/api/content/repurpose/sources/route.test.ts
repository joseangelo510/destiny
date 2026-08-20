import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { getClaims, from, insertRow, updateRow, maybeSingle } =
  vi.hoisted(() => ({
    getClaims: vi.fn(),
    from: vi.fn(),
    insertRow: vi.fn(),
    updateRow: vi.fn(),
    maybeSingle: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims }, from }),
}));

const mockIngestSourceFile = vi.hoisted(() => vi.fn());
const mockIngestSourceUrl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/repurpose-source", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/content/repurpose-source")>();
  return {
    ...original,
    ingestSourceFile: mockIngestSourceFile,
  };
});

vi.mock("@/lib/content/repurpose-url", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/content/repurpose-url")>();
  return {
    ...original,
    ingestSourceUrl: mockIngestSourceUrl,
  };
});

import { POST, PATCH } from "./route";
import { RepurposeSourceError } from "@/lib/content/repurpose-source";
import { RepurposeUrlError } from "@/lib/content/repurpose-url";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const websiteId = "831740e7-b8f7-4612-8fe4-794219031191";
const sourceId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const orgId = "org-00000000-0000-4000-8000-000000000001";

const LONG_TEXT = "This is sample content. ".repeat(100); // well over 50 non-ws chars

function makeFormData(
  fields: Record<string, string | [Blob, string]>,
): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      fd.append(key, value[0], value[1]);
    } else {
      fd.append(key, value);
    }
  }
  return fd;
}

function buildRequest(formData: FormData): Request {
  return new Request("http://localhost/api/content/repurpose/sources", {
    method: "POST",
    body: formData,
  });
}

function buildPatchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/content/repurpose/sources", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = "test-session-secret-for-repurpose-encryption";
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });

  // Default: website accessible
  maybeSingle.mockResolvedValue({
    data: { id: websiteId, organization_id: orgId },
    error: null,
  });

  // Default: insert succeeds, returns source row (no extracted_text)
  insertRow.mockResolvedValue({
    data: {
      id: sourceId,
      source_kind: "paste",
      source_name: "Pasted text",
      source_url: null,
      mime_type: null,
      source_size_bytes: 0,
      extracted_characters: 2400,
      status: "ready",
    },
    error: null,
  });

  // Default update succeeds
  updateRow.mockResolvedValue({
    data: {
      id: sourceId,
      source_kind: "paste",
      source_name: "Pasted text",
      source_url: null,
      mime_type: null,
      source_size_bytes: 0,
      extracted_characters: 2400,
      status: "ready",
      output_type: null,
      target_keyword: null,
      draft_title: "My draft title",
      draft_body: "Body content here",
      draft_metadata: null,
    },
    error: null,
  });

  from.mockImplementation((table: string) => {
    if (table === "websites") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle }),
        }),
      };
    }
    if (table === "repurpose_sources") {
      return {
        insert: () => ({
          select: () => ({ single: insertRow }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle }),
            maybeSingle,
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({ single: updateRow }),
              // for update without select
              then: updateRow,
            }),
            select: () => ({ single: updateRow }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  // Default file ingestion
  mockIngestSourceFile.mockResolvedValue({
    extension: "txt",
    mimeType: "text/plain",
    text: LONG_TEXT,
    sizeBytes: 1024,
  });

  // Default URL ingestion
  mockIngestSourceUrl.mockResolvedValue({
    url: "https://example.com/article",
    title: "Example Article",
    text: LONG_TEXT,
    source: "html",
  });
});

// ---------------------------------------------------------------------------
// POST — authentication
// ---------------------------------------------------------------------------

describe("POST /api/content/repurpose/sources", () => {
  it("rejects unauthenticated requests before any ingestion", async () => {
    getClaims.mockResolvedValue({ data: { claims: {} } });
    const fd = makeFormData({
      websiteId,
      sourceMode: "paste",
      text: LONG_TEXT,
    });
    const response = await POST(buildRequest(fd));

    expect(response.status).toBe(401);
    expect(mockIngestSourceFile).not.toHaveBeenCalled();
    expect(mockIngestSourceUrl).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // POST — invalid IDs / params
  // ---------------------------------------------------------------------------

  it("rejects a missing or malformed websiteId", async () => {
    const fd = makeFormData({ websiteId: "not-a-uuid", sourceMode: "paste", text: LONG_TEXT });
    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/websiteId/i);
  });

  it("rejects an invalid sourceMode", async () => {
    const fd = makeFormData({ websiteId, sourceMode: "invalid", text: LONG_TEXT });
    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/sourceMode/i);
  });

  // ---------------------------------------------------------------------------
  // POST — website unavailability
  // ---------------------------------------------------------------------------

  it("returns 404 when the website is not accessible via RLS", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const fd = makeFormData({ websiteId, sourceMode: "paste", text: LONG_TEXT });
    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatch(/website/i);
  });

  it("returns 503 before ingestion when secure source storage is not configured", async () => {
    delete process.env.SESSION_SECRET;
    const fd = makeFormData({ websiteId, sourceMode: "paste", text: LONG_TEXT });

    const response = await POST(buildRequest(fd));

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("SOURCE_ENCRYPTION_NOT_CONFIGURED");
    expect(mockIngestSourceFile).not.toHaveBeenCalled();
    expect(mockIngestSourceUrl).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // POST — file mode
  // ---------------------------------------------------------------------------

  it("rejects files larger than 20 MB before calling arrayBuffer", async () => {
    // Create a real Blob/File-like with 20MB+1 size.
    // We use a Blob with a size property ≥ 20MB to trigger the pre-check.
    // The route reads file.size before calling arrayBuffer.
    const bigContent = new Uint8Array(21 * 1024 * 1024);
    const bigFile = new File([bigContent], "big.pdf", {
      type: "application/pdf",
    });

    // Verify the File has the expected size
    expect(bigFile.size).toBe(21 * 1024 * 1024);

    const fd = new FormData();
    fd.append("websiteId", websiteId);
    fd.append("sourceMode", "file");
    fd.append("file", bigFile, "big.pdf");

    // ingestSourceFile should never be called since pre-check should reject first
    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(413);
    expect(mockIngestSourceFile).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.code).toBe("OVERSIZED");
  });

  it("maps RepurposeSourceError UNSUPPORTED to 400", async () => {
    mockIngestSourceFile.mockRejectedValue(
      new RepurposeSourceError("Unsupported file type.", "UNSUPPORTED"),
    );
    const file = new File(["data"], "test.xyz", { type: "application/octet-stream" });
    const fd = makeFormData({ websiteId, sourceMode: "file" });
    fd.append("file", file, "test.xyz");

    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("UNSUPPORTED");
  });

  it("maps RepurposeSourceError NO_TEXT to 422", async () => {
    mockIngestSourceFile.mockRejectedValue(
      new RepurposeSourceError("No text.", "NO_TEXT"),
    );
    const file = new File(["   "], "blank.txt", { type: "text/plain" });
    const fd = makeFormData({ websiteId, sourceMode: "file" });
    fd.append("file", file, "blank.txt");

    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("NO_TEXT");
  });

  it("inserts source metadata after successful file ingestion (never extracted_text)", async () => {
    const file = new File(["Hello world content"], "doc.txt", {
      type: "text/plain",
    });
    const fd = makeFormData({ websiteId, sourceMode: "file" });
    fd.append("file", file, "doc.txt");

    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.source).toBeDefined();
    expect(body.source).not.toHaveProperty("extractedText");
    expect(body.source.extractedCharacters).toBe(2400);
    expect(body.source.kind).toBe("paste"); // from mock
    expect(body.source.id).toBe(sourceId);
  });

  // ---------------------------------------------------------------------------
  // POST — URL mode
  // ---------------------------------------------------------------------------

  it("maps RepurposeUrlError INVALID_URL to 400", async () => {
    mockIngestSourceUrl.mockRejectedValue(
      new RepurposeUrlError("Not a valid URL.", "INVALID_URL"),
    );
    const fd = makeFormData({ websiteId, sourceMode: "url", url: "not-a-url" });
    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("INVALID_URL");
  });

  it("maps RepurposeUrlError RESPONSE_TOO_LARGE to 413", async () => {
    mockIngestSourceUrl.mockRejectedValue(
      new RepurposeUrlError("Too large.", "RESPONSE_TOO_LARGE"),
    );
    const fd = makeFormData({
      websiteId,
      sourceMode: "url",
      url: "https://example.com",
    });
    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.code).toBe("RESPONSE_TOO_LARGE");
  });

  it("maps RepurposeUrlError NO_CONTENT to 422", async () => {
    mockIngestSourceUrl.mockRejectedValue(
      new RepurposeUrlError("No content.", "NO_CONTENT"),
    );
    const fd = makeFormData({
      websiteId,
      sourceMode: "url",
      url: "https://example.com",
    });
    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("NO_CONTENT");
  });

  // ---------------------------------------------------------------------------
  // POST — paste mode
  // ---------------------------------------------------------------------------

  it("rejects paste with fewer than 50 non-whitespace characters", async () => {
    const fd = makeFormData({
      websiteId,
      sourceMode: "paste",
      text: "short",
    });
    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("NO_TEXT");
  });

  it("accepts valid paste and inserts a source row", async () => {
    const fd = makeFormData({
      websiteId,
      sourceMode: "paste",
      text: LONG_TEXT,
    });
    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source.id).toBe(sourceId);
    expect(body.source).not.toHaveProperty("extractedText");
  });

  it("caps paste at 120 000 characters and persists only ciphertext", async () => {
    const hugeText = "a".repeat(130_000);
    const fd = makeFormData({ websiteId, sourceMode: "paste", text: hugeText });

    // Capture what was inserted
    let capturedInsert: Record<string, unknown> | null = null;
    from.mockImplementation((table: string) => {
      if (table === "websites") {
        return { select: () => ({ eq: () => ({ maybeSingle }) }) };
      }
      if (table === "repurpose_sources") {
        return {
          insert: (data: Record<string, unknown>) => {
            capturedInsert = data;
            return { select: () => ({ single: insertRow }) };
          },
          select: () => ({ eq: () => ({ maybeSingle }) }),
          update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: updateRow }) }) }) }),
        };
      }
      throw new Error("Unexpected table");
    });

    const response = await POST(buildRequest(fd));
    expect(response.status).toBe(200);
    expect(capturedInsert).not.toHaveProperty("extracted_text");
    expect(typeof capturedInsert?.extracted_text_ciphertext).toBe("string");
    expect(capturedInsert?.extracted_text_ciphertext).not.toContain("a".repeat(100));
    expect(capturedInsert?.extracted_characters).toBe(120_000);
    expect(capturedInsert?.encryption_version).toBe("aes-256-gcm-v1");
  });

  // ---------------------------------------------------------------------------
  // POST — response never includes extracted_text
  // ---------------------------------------------------------------------------

  it("never includes extracted_text in the POST response", async () => {
    const fd = makeFormData({ websiteId, sourceMode: "paste", text: LONG_TEXT });
    const response = await POST(buildRequest(fd));
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("extractedText");
    expect(JSON.stringify(body)).not.toContain("extracted_text");
  });
});

// ---------------------------------------------------------------------------
// PATCH — authentication
// ---------------------------------------------------------------------------

describe("PATCH /api/content/repurpose/sources", () => {
  it("rejects unauthenticated PATCH requests", async () => {
    getClaims.mockResolvedValue({ data: { claims: {} } });
    const response = await PATCH(
      buildPatchRequest({ websiteId, sourceId, title: "New title" }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects invalid websiteId UUID", async () => {
    const response = await PATCH(
      buildPatchRequest({ websiteId: "not-a-uuid", sourceId, title: "T" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/websiteId/i);
  });

  it("rejects invalid sourceId UUID", async () => {
    const response = await PATCH(
      buildPatchRequest({ websiteId, sourceId: "bad-id", title: "T" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/sourceId/i);
  });

  it("returns 404 when website is not accessible", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await PATCH(
      buildPatchRequest({ websiteId, sourceId, title: "T", bodyMarkdown: "Body" }),
    );
    expect(response.status).toBe(404);
  });

  it("denies cross-site source IDs (sourceId belongs to a different website)", async () => {
    // Website resolves, but source lookup returns null (different site)
    let callCount = 0;
    maybeSingle.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // website lookup
        return { data: { id: websiteId, organization_id: orgId }, error: null };
      }
      // source lookup for different site
      return { data: null, error: null };
    });

    const response = await PATCH(
      buildPatchRequest({
        websiteId,
        sourceId: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
        title: "Title",
        bodyMarkdown: "Body",
      }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatch(/source/i);
  });

  it("saves editable draft fields and returns updated source (without extracted_text)", async () => {
    let callCount = 0;
    maybeSingle.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { data: { id: websiteId, organization_id: orgId }, error: null };
      }
      return {
        data: { id: sourceId, website_id: websiteId, organization_id: orgId },
        error: null,
      };
    });

    const response = await PATCH(
      buildPatchRequest({
        websiteId,
        sourceId,
        title: "My draft title",
        bodyMarkdown: "Body content here",
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBeDefined();
    expect(body.source.draftTitle).toBe("My draft title");
    expect(body.source.draftBody).toBe("Body content here");
    expect(JSON.stringify(body)).not.toContain("extractedText");
    expect(JSON.stringify(body)).not.toContain("extracted_text");
  });
});
