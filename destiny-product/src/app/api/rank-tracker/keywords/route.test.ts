import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, inserted, listVisible, existingKeyword } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  inserted: [] as Array<Record<string, unknown>>,
  listVisible: { value: true },
  existingKeyword: { value: null as null | Record<string, unknown> },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims },
    from: (table: string) => {
      if (table === "websites") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "site-1" }, error: null }) }) }) };
      if (table === "rank_tracker_lists") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: listVisible.value ? { id: "list-1" } : null, error: null }) }) }) }) };
      if (table === "tracked_keywords") {
        const selectChain = {
          eq: () => selectChain,
          maybeSingle: async () => ({ data: existingKeyword.value, error: null }),
        };
        return {
          select: () => selectChain,
          insert: (row: Record<string, unknown>) => {
            inserted.push(row);
            return { select: () => ({ single: async () => ({ data: {
              id: "keyword-1", keyword: row.keyword, list_id: row.list_id, status: row.status ?? "pending", source: row.source,
              created_at: "2026-08-27T18:00:00.000Z", last_checked_at: null,
            }, error: null }) }) };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

describe("POST /api/rank-tracker/keywords research saves", () => {
  beforeEach(() => {
    inserted.length = 0;
    listVisible.value = true;
    existingKeyword.value = null;
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  });

  it("saves a research keyword without scheduling rank checks when tracking is off", async () => {
    const response = await POST(new Request("http://localhost/api/rank-tracker/keywords", { method: "POST", body: JSON.stringify({
      websiteId: "site-1", keyword: "youtube advertising services", listId: "list-1", source: "research", track: false,
    }) }));
    expect(response.status).toBe(200);
    expect(inserted).toContainEqual(expect.objectContaining({ source: "research", status: "paused", list_id: "list-1" }));
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ keyword: expect.objectContaining({ status: "paused" }) }));
  });

  it("starts the first rank reading when tracking is on", async () => {
    const response = await POST(new Request("http://localhost/api/rank-tracker/keywords", { method: "POST", body: JSON.stringify({
      websiteId: "site-1", keyword: "youtube advertising services", source: "research", track: true,
    }) }));
    expect(response.status).toBe(200);
    expect(inserted).toContainEqual(expect.objectContaining({ source: "research", status: "pending" }));
  });

  it("rejects a list that is not available in the selected website", async () => {
    listVisible.value = false;
    const response = await POST(new Request("http://localhost/api/rank-tracker/keywords", { method: "POST", body: JSON.stringify({
      websiteId: "site-1", keyword: "youtube advertising services", listId: "other-site-list", source: "research", track: false,
    }) }));
    expect(response.status).toBe(404);
    expect(inserted).toEqual([]);
  });
});
