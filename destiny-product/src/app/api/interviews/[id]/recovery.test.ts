import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: "owner", missing: false, broken: false, calls: [] as unknown[][] }));
vi.mock("@/lib/db", () => ({ scopedClient: async (website: string) => {
  state.calls.push(["website", website]);
  return { getClaims: async () => state.user || null, select: (table: string) => {
    const rows: Record<string, unknown>[] = table === "interview_questions" ? [
      { id: "q1", position: 1, kind: "warm_up", text: "First", skipped: false },
      { id: "q2", position: 2, kind: "story", text: "Second", skipped: true },
      { id: "q3", position: 3, kind: "evidence", text: "Third", skipped: false },
    ] : table === "interview_answers" ? [
      { id: "a1", question_id: "q1", verbatim_text: "  Exact words.  ", retracted_at: null },
      { id: "a2", question_id: "q3", verbatim_text: "Retracted", retracted_at: "2026-09-21" },
    ] : [{ id: "v1", interview_id: "i1", answer_id: "a1", type: "theme", title: "Theme", body: "Exact words.", status: "rejected_by_owner" }];
    const query = {
      eq: (column: string, value: unknown) => { state.calls.push([table, column, value]); return query; },
      order: () => Promise.resolve({ data: rows, error: state.broken ? { message: "unavailable" } : null }),
      maybeSingle: async () => ({ data: state.missing ? null : { id: "i1", status: "in_progress", topic_title: "Topic", focus_keyword: "Topic" }, error: null }),
    };
    return query;
  } };
} }));
import { GET } from "./route";

const website = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const call = () => GET(new Request(`http://localhost/api/interviews/${id}?websiteId=${website}`), { params: Promise.resolve({ id }) });
beforeEach(() => { state.user = "owner"; state.missing = false; state.broken = false; state.calls = []; });

describe("saved interview recovery", () => {
  it("preserves exact text and rejected status and resumes at the unanswered question", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { interview } = await response.json();
    expect(interview.nextQuestionIndex).toBe(2);
    expect(interview.answers).toEqual([{ id: "a1", question: "First", verbatimText: "  Exact words.  " }]);
    expect(interview.libraryItems[0]).toMatchObject({ status: "rejected_by_owner", sourceText: "  Exact words.  " });
    expect(state.calls).toContainEqual(["website", website]);
    expect(state.calls).toContainEqual(["interviews", "created_by", "owner"]);
    for (const table of ["interview_questions", "interview_answers", "voice_library_items"]) expect(state.calls).toContainEqual([table, "interview_id", id]);
  });
  it("denies a signed-out request", async () => { state.user = ""; expect((await call()).status).toBe(401); });
  it("returns unavailable for a missing scoped interview", async () => { state.missing = true; expect((await call()).status).toBe(404); });
  it("does not turn a failed child query into an empty successful interview", async () => { state.broken = true; expect((await call()).status).toBe(500); });
});
