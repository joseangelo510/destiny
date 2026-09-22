import { expect, it, vi } from "vitest";
import { scopedClient } from "@/lib/db";
vi.mock("@/lib/db", () => ({ scopedClient: vi.fn() }));
import { resolveInterviewAuditContext } from "./interview-audit-context";
import type { getWorkspaceContext } from "@/lib/workspace-context";
const site = "11111111-1111-4111-8111-111111111111";
const interview = "22222222-2222-4222-8222-222222222222";
const oldAudit = "33333333-3333-4333-8333-333333333333";
function fixture({ missing = false, fail = false, same = false } = {}) {
  const queries: { table: string; filters: [string, unknown][] }[] = [];
  const supabase = { from: vi.fn((table: string) => {
    const call = { table, filters: [] as [string, unknown][] }; queries.push(call);
    const q = { select: () => q, eq: (key: string, value: unknown) => { call.filters.push([key, value]); return q; },
      maybeSingle: () => q, order: () => q, limit: () => q,
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ error: fail ? { message: "unavailable" } : null,
        data: missing ? null : table === "article_drafts" ? { audit_id: same ? "latest" : oldAudit }
          : table === "audits" ? { id: oldAudit, website_id: site, status: "complete" }
          : table === "audit_metrics" ? { raw_provider_payload: { original: true } }
          : [{ id: "original-quest", audit_id: oldAudit }] }).then(resolve) };
    return q;
  }) };
  const context = { supabase, userId: "owner", website: { id: site }, audit: { id: "latest" }, metrics: { current: true }, quests: [], integrations: [], competitors: [], websites: [], profile: null } as unknown as Awaited<ReturnType<typeof getWorkspaceContext>>;
  vi.mocked(scopedClient).mockResolvedValue({ select: (table: string) => supabase.from(table).select().eq("website_id", site) } as unknown as Awaited<ReturnType<typeof scopedClient>>);
  return { context, queries };
}
it("recovers original audit, metrics and quests while retaining website and user", async () => {
  const { context, queries } = fixture();
  const recovered = await resolveInterviewAuditContext(context, interview);
  expect(recovered.audit?.id).toBe(oldAudit);
  expect(recovered.metrics).toMatchObject({ raw_provider_payload: { original: true } });
  expect(recovered.quests).toEqual([{ id: "original-quest", audit_id: oldAudit }]);
  expect(recovered.website).toBe(context.website);
  expect(recovered.supabase).toBe(context.supabase);
  expect(queries.find(q => q.table === "article_drafts")?.filters).toContainEqual(["website_id", site]);
  expect(queries.find(q => q.table === "article_drafts")?.filters).toContainEqual(["interview_id", interview]);
  expect(queries.find(q => q.table === "audits")?.filters).toContainEqual(["website_id", site]);
  expect(queries.find(q => q.table === "quests")?.filters).toContainEqual(["website_id", site]);
});
it.each([undefined, "invalid"])("does not query without a valid explicit interview: %s", async value => {
  const { context, queries } = fixture();
  expect(await resolveInterviewAuditContext(context, value)).toBe(context);
  expect(queries).toHaveLength(0);
});
it.each([{ missing: true }, { fail: true }, { same: true }])("preserves current context when recovery is unavailable or unnecessary: %j", async options => {
  const { context } = fixture(options);
  expect(await resolveInterviewAuditContext(context, interview)).toBe(context);
});
