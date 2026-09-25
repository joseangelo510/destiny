import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, from, invoke, rpc } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  from: vi.fn(),
  invoke: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims }, from, functions: { invoke }, rpc }),
}));

import { POST } from "./route";

const websiteId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";

function request() {
  return new Request("http://localhost/api/content/publishing-plan/reconcile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ websiteId, itemId }),
  });
}

function scheduleBuilder(item: Record<string, unknown> | null) {
  const updates: Array<Record<string, unknown>> = [];
  let reads = 0;
  from.mockImplementation((table: string) => {
    if (table !== "publishing_schedule_items") throw new Error(`Unexpected table ${table}`);
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              reads += 1;
              return { data: item, error: null };
            }),
          })),
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => {
            updates.push(payload);
            return { data: null, error: null };
          }),
        })),
      })),
    };
  });
  return { updates, reads: () => reads };
}

describe("POST /api/content/publishing-plan/reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    rpc.mockResolvedValue({ data: [{
      provider: "wordpress",
      articleKey: "audit-1:ban-the-box-laws",
      publicationStatus: "verified_live",
      remoteStatus: "publish",
      remoteEditUrl: "https://clearcheck.app/wp-admin/post.php?post=20208955&action=edit",
      remotePermalink: "https://clearcheck.app/ban-the-box-laws/",
      verificationEvidence: { verified: true },
    }], error: null });
  });

  it("does not call WordPress for a future or delivery-only item", async () => {
    scheduleBuilder({
      id: itemId,
      article_key: null,
      content_type: "Blog guide",
      state: "needs_review",
      scheduled_for: "2026-09-21T16:00:00.000Z",
      remote_id: "20208953",
    });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("marks a past-due WordPress slot published only after public verification", async () => {
    const database = scheduleBuilder({
      id: itemId,
      article_key: "audit-1:ban-the-box-laws",
      content_type: "Blog guide",
      state: "scheduled",
      scheduled_for: "2026-08-21T16:00:00.000Z",
      remote_id: "20208955",
      remote_edit_url: "https://clearcheck.app/wp-admin/post.php?post=20208955&action=edit",
      remote_permalink: null,
      last_error: null,
    });
    invoke.mockResolvedValue({
      data: {
        reconciled: true,
        publicationStatus: "verified_live",
        remotePermalink: "https://clearcheck.app/ban-the-box-laws/",
        verifiedLiveAt: "2026-08-27T20:00:00.000Z",
      },
      error: null,
    });

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ verified: true, state: "published" });
    expect(database.updates).toContainEqual({
      state: "published",
      remote_permalink: "https://clearcheck.app/ban-the-box-laws/",
      last_error: null,
    });
  });

  it("keeps a past-due slot scheduled when WordPress cannot verify a live page", async () => {
    const database = scheduleBuilder({
      id: itemId,
      article_key: "audit-1:ban-the-box-laws",
      content_type: "Blog guide",
      state: "scheduled",
      scheduled_for: "2026-08-21T16:00:00.000Z",
      remote_id: "20208955",
    });
    invoke.mockResolvedValue({ data: null, error: { message: "timeout" } });

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(database.updates).toEqual([]);
  });

  it("records a matching CMS-published post as needing review without claiming public verification", async () => {
    const database = scheduleBuilder({
      id: itemId,
      article_key: "audit-1:ban-the-box-laws",
      content_type: "Blog guide",
      state: "scheduled",
      scheduled_for: "2026-08-21T16:00:00.000Z",
      remote_id: "20208955",
      remote_edit_url: "https://clearcheck.app/wp-admin/post.php?post=20208955&action=edit",
    });
    const reason = "The published page is missing its required featured image metadata.";
    const receipt = {
      provider: "wordpress",
      articleKey: "audit-1:ban-the-box-laws",
      publicationStatus: "published_unverified",
      remoteStatus: "publish",
      remoteEditUrl: "https://clearcheck.app/wp-admin/post.php?post=20208955&action=edit",
      remotePermalink: "https://clearcheck.app/ban-the-box-laws/",
      verificationEvidence: { remoteStatus: "publish", reason },
    };
    rpc.mockResolvedValue({ data: [receipt], error: null });
    invoke.mockResolvedValue({ data: {
      reconciled: true,
      publicationStatus: "published_unverified",
      remotePermalink: receipt.remotePermalink,
      verificationEvidence: receipt.verificationEvidence,
    }, error: null });

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ verified: false, published: true, state: "needs_review", remotePermalink: receipt.remotePermalink, lastError: reason });
    expect(database.updates).toContainEqual({ state: "needs_review", remote_permalink: receipt.remotePermalink, last_error: reason });
  });

  it("refuses to attach a different WordPress post to the calendar item", async () => {
    const database = scheduleBuilder({
      id: itemId,
      article_key: "audit-1:ban-the-box-laws",
      content_type: "Blog guide",
      state: "scheduled",
      scheduled_for: "2026-08-21T16:00:00.000Z",
      remote_id: "20208955",
      remote_edit_url: "https://clearcheck.app/wp-admin/post.php?post=20208955&action=edit",
    });
    rpc.mockResolvedValue({ data: [{
      provider: "wordpress",
      articleKey: "audit-1:ban-the-box-laws",
      publicationStatus: "verified_live",
      remoteStatus: "publish",
      remoteEditUrl: "https://clearcheck.app/wp-admin/post.php?post=20209996&action=edit",
      remotePermalink: "https://clearcheck.app/another-post/",
    }], error: null });
    invoke.mockResolvedValue({ data: {
      reconciled: true,
      publicationStatus: "verified_live",
      remotePermalink: "https://clearcheck.app/another-post/",
    }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(database.updates).toEqual([]);
  });
});
