import { beforeEach, describe, expect, it, vi } from "vitest";

const { decisionRows, existingDecisions, providerKeywords, trackedRows } = vi.hoisted(() => ({
  decisionRows: [] as Array<{ keyword: string; decision: string }>,
  existingDecisions: [] as Array<{ keyword: string; decision: "approved" | "declined" }>,
  providerKeywords: [] as Array<Record<string, unknown>>,
  trackedRows: [] as Array<{ keyword: string }>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    from: (table: string) => {
      if (table === "audits") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "audit-1", website_id: "site-1", requested_by: "user-1" }, error: null }) }) }),
      };
      if (table === "audit_metrics") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { raw_provider_payload: { providerResult: { keywords: providerKeywords } } }, error: null }) }) }),
      };
      if (table === "keyword_decisions") return {
        select: () => ({ eq: async () => ({ data: existingDecisions, error: null }) }),
        upsert: (rows: Array<{ keyword: string; decision: string }>) => {
          decisionRows.push(...rows);
          return { select: async () => ({ data: rows, error: null }) };
        },
      };
      if (table === "tracked_keywords") return {
        upsert: async (rows: Array<{ keyword: string }>) => {
          trackedRows.push(...rows);
          return { error: null };
        },
        update: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ error: null }) }) }) }) }),
      };
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { POST } from "./route";

const recommendation = (keyword: string, searchVolume = 100) => ({
  keyword,
  searchVolume,
  priorityScore: 90,
  priorityReason: "Measured high-intent opportunity",
  themeId: "services",
  themeLabel: "Services",
});

describe("POST /api/keywords/decisions quick approval", () => {
  beforeEach(() => {
    decisionRows.length = 0;
    existingDecisions.length = 0;
    providerKeywords.length = 0;
    trackedRows.length = 0;
  });

  it("approves and starts tracking the saved audit's first five qualified recommendations", async () => {
    providerKeywords.push(
      recommendation("qualified one"),
      recommendation("zero demand", 0),
      recommendation("qualified two"),
      recommendation("qualified three"),
      recommendation("qualified four"),
      recommendation("qualified five"),
      recommendation("qualified six"),
    );

    const response = await POST(new Request("http://localhost/api/keywords/decisions", {
      method: "POST",
      body: JSON.stringify({ auditId: "audit-1", approveRecommended: true }),
    }));

    expect(response.status).toBe(200);
    expect(decisionRows.map((item) => item.keyword)).toEqual([
      "qualified one",
      "qualified two",
      "qualified three",
      "qualified four",
      "qualified five",
    ]);
    expect(decisionRows.every((item) => item.decision === "approved")).toBe(true);
    expect(trackedRows.map((item) => item.keyword)).toEqual(decisionRows.map((item) => item.keyword));
  });
});
