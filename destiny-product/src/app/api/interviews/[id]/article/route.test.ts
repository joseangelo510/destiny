import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ generated: true, fail: false, writes: [] as Record<string, unknown>[] }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: "owner" } } }) } }) }));
vi.mock("@/lib/interviews/interviews", () => ({ buildInterviewArticleDraft: () => ({ keyword: "topic" }) }));
vi.mock("@/lib/interviews/server", () => ({ websiteScopedClient: () => ({ from(table: string) {
  let mutation = false;
  const query = {
    select: () => query, eq: () => query, order: () => query, is: () => query, maybeSingle: () => query,
    update: (value: Record<string, unknown>) => { mutation = true; state.writes.push(value); return query; },
    upsert: (value: Record<string, unknown>) => { mutation = true; state.writes.push(value); return query; },
    then(resolve: (result: { data: unknown; error: unknown }) => unknown) {
      const data = mutation ? null : table === "interviews" ? { id: "i1", created_by: "owner", website_id: "s1", audit_id: "a1", topic_title: "Topic", focus_keyword: "topic" }
        : table === "websites" ? { business_name: "Test" }
        : table === "interview_questions" ? [{ id: "q1", text: "Question" }]
        : table === "interview_answers" ? [{ question_id: "q1", verbatim_text: "Exact answer" }]
        : state.generated ? { id: "d1", draft: { generationStatus: "generated", body: "Preserved" } } : null;
      return Promise.resolve({ data, error: mutation && state.fail ? { message: "write failed" } : null }).then(resolve);
    },
  };
  return query;
} }) }));
import { POST } from "./route";
const call = () => POST(new Request("http://localhost/api/interviews/i1/article"), { params: Promise.resolve({ id: "i1" }) });
beforeEach(() => { state.generated = true; state.fail = false; state.writes = []; });
it("reports linkage failure and supports retry without replacing generated text", async () => {
  state.fail = true;
  const failed = await call();
  expect(failed.status).toBe(500);
  expect(await failed.json()).toEqual({ error: "Rebound SEO could not prepare the Content Studio draft." });
  state.fail = false;
  expect((await call()).status).toBe(200);
  expect(state.writes).toEqual([{ interview_id: "i1" }, { interview_id: "i1" }]);
});
it("preserves existing generated draft on successful linkage", async () => {
  expect((await call()).status).toBe(200);
  expect(state.writes).toEqual([{ interview_id: "i1" }]);
});
it("keeps new-draft write failure visible", async () => {
  state.generated = false; state.fail = true;
  expect((await call()).status).toBe(500);
});
it("prepares a new draft when its write succeeds", async () => {
  state.generated = false;
  expect((await call()).status).toBe(200);
  expect(state.writes[0]).toMatchObject({ website_id: "s1", audit_id: "a1", interview_id: "i1", draft: { keyword: "topic" } });
});
