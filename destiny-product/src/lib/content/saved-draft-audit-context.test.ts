import { expect, it, vi } from "vitest";
import { scopedClient } from "@/lib/db";
vi.mock("@/lib/db", () => ({ scopedClient: vi.fn() }));
import { resolveSavedDraftAuditContext } from "./interview-audit-context";
import type { getWorkspaceContext } from "@/lib/workspace-context";

const site = "11111111-1111-4111-8111-111111111111";
const draftId = "22222222-2222-4222-8222-222222222222";
const oldAudit = "33333333-3333-4333-8333-333333333333";

function fixture({ missing = false, old = false } = {}) {
  const queries: { table: string; filters: [string, unknown][] }[] = [];
  const supabase = { from: vi.fn((table: string) => {
    const call = { table, filters: [] as [string, unknown][] }; queries.push(call);
    const q = { select: () => q, eq: (key: string, value: unknown) => { call.filters.push([key, value]); return q; },
      maybeSingle: () => q, order: () => q, limit: () => q,
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ error: null,
        data: table === "article_drafts" ? missing ? null : { audit_id: old ? oldAudit : "44444444-4444-4444-8444-444444444444", keyword: "specific article" }
          : table === "audits" ? { id: oldAudit, website_id: site, status: "complete" }
          : table === "audit_metrics" ? { original: true }
          : [{ id: "original-quest", audit_id: oldAudit }] }).then(resolve) };
    return q;
  }) };
  const context = { supabase, userId: "owner", website: { id: site }, audit: { id: "44444444-4444-4444-8444-444444444444" }, metrics: { current: true }, quests: [], integrations: [], competitors: [], websites: [], profile: null } as unknown as Awaited<ReturnType<typeof getWorkspaceContext>>;
  vi.mocked(scopedClient).mockResolvedValue({ select: (table: string) => supabase.from(table).select().eq("website_id", site) } as unknown as Awaited<ReturnType<typeof scopedClient>>);
  return { context, queries };
}

it("resolves the exact saved draft within the selected website and its original audit", async () => {
  const { context, queries } = fixture({ old: true });
  const result = await resolveSavedDraftAuditContext(context, draftId);
  expect(result?.keyword).toBe("specific article");
  expect(result?.context.audit?.id).toBe(oldAudit);
  expect(result?.context.metrics).toMatchObject({ original: true });
  expect(result?.context.website).toBe(context.website);
  expect(queries.find(q => q.table === "article_drafts")?.filters).toEqual([["website_id", site], ["id", draftId]]);
  expect(queries.find(q => q.table === "audits")?.filters).toContainEqual(["website_id", site]);
});

it("returns no selected draft for an invalid or inaccessible id", async () => {
  const { context, queries } = fixture({ missing: true });
  expect(await resolveSavedDraftAuditContext(context, "invalid")).toBeNull();
  expect(queries).toHaveLength(0);
  expect(await resolveSavedDraftAuditContext(context, draftId)).toBeNull();
  expect(queries.find(q => q.table === "article_drafts")?.filters).toContainEqual(["website_id", site]);
});

it("keeps the current audit when the saved draft belongs to it", async () => {
  const { context, queries } = fixture();
  const result = await resolveSavedDraftAuditContext(context, draftId);
  expect(result?.context).toBe(context);
  expect(result?.keyword).toBe("specific article");
  expect(queries.map(q => q.table)).toEqual(["article_drafts"]);
});
