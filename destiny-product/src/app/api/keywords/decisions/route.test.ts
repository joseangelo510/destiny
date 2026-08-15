import { beforeEach, describe, expect, it, vi } from "vitest";

const { decisionRows, existingDecisions, preferenceRows, deletedPreferences, providerKeywords, trackedRows } = vi.hoisted(() => ({
  decisionRows: [] as Array<{ keyword: string; normalized_keyword?: string; decision: string; reason?: string | null }>,
  existingDecisions: [] as Array<{ keyword: string; decision: "approved" | "declined" }>,
  preferenceRows: [] as Array<{ keyword: string; normalized_keyword: string; decision: string; reason?: string | null }>,
  deletedPreferences: [] as string[],
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
      if (table === "websites") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { organization_id: "org-1" }, error: null }) }) }),
      };
      if (table === "keyword_decisions") return {
        upsert: (rows: Array<{ keyword: string; decision: string; reason?: string | null }>) => {
          decisionRows.push(...rows);
          return { select: async () => ({ data: rows, error: null }) };
        },
      };
      if (table === "keyword_preferences") return {
        select: () => ({ eq: async () => ({ data: existingDecisions, error: null }) }),
        upsert: async (rows: Array<{ keyword: string; normalized_keyword: string; decision: string; reason?: string | null }>) => {
          preferenceRows.push(...rows);
          return { error: null };
        },
        delete: () => ({ eq: () => ({ eq: () => ({ eq: async (_column: string, keyword: string) => { deletedPreferences.push(keyword); return { error: null }; } }) }) }),
      };
      if (table === "tracked_keywords") return {
        upsert: async (rows: Array<{ keyword: string }>) => {
          trackedRows.push(...rows);
          return { error: null };
        },
        update: () => {
          const chain = { eq: () => chain, in: async () => ({ error: null }) };
          return chain;
        },
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
    preferenceRows.length = 0;
    deletedPreferences.length = 0;
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
    expect(preferenceRows.map((item) => item.normalized_keyword)).toEqual(decisionRows.map((item) => item.keyword));
  });

  it("saves the optional decline reason to the durable website preference", async () => {
    const response = await POST(new Request("http://localhost/api/keywords/decisions", {
      method: "POST",
      body: JSON.stringify({ auditId: "audit-1", keyword: "wrong service phrase", decision: "declined", reason: "wrong_audience" }),
    }));

    expect(response.status).toBe(200);
    expect(decisionRows).toContainEqual(expect.objectContaining({ keyword: "wrong service phrase", decision: "declined", reason: "wrong_audience" }));
    expect(preferenceRows).toContainEqual(expect.objectContaining({ normalized_keyword: "wrong service phrase", decision: "declined", reason: "wrong_audience" }));
  });

  it("does not re-approve a keyword the website declined during an earlier audit", async () => {
    existingDecisions.push({ keyword: "previously declined", decision: "declined" });
    providerKeywords.push(
      recommendation("previously declined"),
      recommendation("qualified one"),
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
    expect(decisionRows.map((item) => item.keyword)).not.toContain("previously declined");
    expect(decisionRows).toHaveLength(5);
  });

  it("restores a keyword to review without deleting its rank history", async () => {
    const response = await POST(new Request("http://localhost/api/keywords/decisions", {
      method: "POST",
      body: JSON.stringify({ auditId: "audit-1", keyword: "reconsider this phrase", action: "restore" }),
    }));

    expect(response.status).toBe(200);
    expect(decisionRows).toEqual([]);
    expect(deletedPreferences).toEqual(["reconsider this phrase"]);
    expect(trackedRows).toEqual([]);
  });
});
