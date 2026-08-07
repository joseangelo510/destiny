import { beforeEach, describe, expect, it, vi } from "vitest";

const { runDestinyServerLogic, state, update } = vi.hoisted(() => ({
  runDestinyServerLogic: vi.fn(),
  state: {
    approvedKeywordCount: 5,
    quest: { id: "quest-1", task_type: "business_confirmation", status: "todo", audit_id: "audit-1", week_number: 1 },
  },
  update: vi.fn(),
}));
const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

vi.mock("../../../../lib/logicaffeine-server", () => ({ runDestinyServerLogic }));
vi.mock("../../../../lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-zero" } } }) },
    from: (table: string) => table === "keyword_decisions"
      ? {
        select: () => ({
          eq: () => ({
            eq: async () => ({ data: Array.from({ length: state.approvedKeywordCount }, (_, index) => ({ keyword: `keyword-${index + 1}` })), error: null }),
          }),
        }),
      }
      : {
        select: (columns: string) => columns.startsWith("id,task_type,status,audit_id")
          ? { eq: () => ({ maybeSingle: async () => ({ data: state.quest, error: null }) }) }
          : { eq: () => ({ eq: async () => ({ data: [{ id: "quest-1", task_type: state.quest.task_type, status: state.quest.status }], error: null }) }) },
        update,
      },
  }),
}));

import { PATCH } from "./route";

describe("PATCH /api/quests/[id] LOGOS policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.approvedKeywordCount = 5;
    state.quest = { id: "quest-1", task_type: "business_confirmation", status: "todo", audit_id: "audit-1", week_number: 1 };
    update.mockReturnValue({
      eq: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: { id: "quest-1", status: "complete", verification_status: "verified" }, error: null }),
        }),
      }),
    });
  });

  it("uses the LOGOS verification and celebration decision with zero fallbacks", async () => {
    runDestinyServerLogic.mockResolvedValue({
      questTransitionAllowed: true,
      questTransitionRuleId: "complete_business_confirmation",
      questVerificationStatus: "verified",
      questSetCompletedAt: true,
      questSetVerifiedAt: true,
      questClearEvidence: false,
      questCelebration: "verified_result",
    });

    const response = await PATCH(new Request("http://localhost/api/quests/quest-1", { method: "PATCH", body: JSON.stringify({ status: "complete" }) }), { params: Promise.resolve({ id: "quest-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ celebration: "verified_result", transitionRuleId: "complete_business_confirmation" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "complete", verification_status: "verified", verification_method: "user_confirmation" }));
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"fallbacks":0'));
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"wasm_errors":0'));
  });

  it("fails closed on a LOGOS boundary error and performs no write", async () => {
    runDestinyServerLogic.mockRejectedValue(new Error("forced wasm failure"));

    const response = await PATCH(new Request("http://localhost/api/quests/quest-1", { method: "PATCH", body: JSON.stringify({ status: "complete" }) }), { params: Promise.resolve({ id: "quest-1" }) });

    expect(response.status).toBe(503);
    expect(update).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"outcome":"fail_closed"'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"wasm_errors":1'));
  });

  it("saves a blocker without treating it as a completion transition", async () => {
    update.mockReturnValue({
      eq: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: { id: "quest-1", status: "todo", guidance_state: "blocked" }, error: null }),
        }),
      }),
    });
    const response = await PATCH(new Request("http://localhost/api/quests/quest-1", { method: "PATCH", body: JSON.stringify({ guidanceState: "blocked", blockerReason: "Need CMS access", blockerOwner: "Site owner" }) }), { params: Promise.resolve({ id: "quest-1" }) });
    expect(response.status).toBe(200);
    expect(runDestinyServerLogic).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ guidance_state: "blocked", blocker_reason: "Need CMS access", blocker_owner: "Site owner" }));
  });

  it("blocks keyword review completion until five keywords are approved", async () => {
    state.quest = { ...state.quest, task_type: "keyword_review" };
    state.approvedKeywordCount = 4;

    const response = await PATCH(new Request("http://localhost/api/quests/quest-1", { method: "PATCH", body: JSON.stringify({ status: "complete" }) }), { params: Promise.resolve({ id: "quest-1" }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ approvedCount: 4, requiredApprovals: 5 });
    expect(runDestinyServerLogic).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("allows keyword review completion after five keywords are approved", async () => {
    state.quest = { ...state.quest, task_type: "keyword_review" };
    runDestinyServerLogic.mockResolvedValue({
      questTransitionAllowed: true,
      questTransitionRuleId: "complete_keyword_review",
      questVerificationStatus: "verified",
      questSetCompletedAt: true,
      questSetVerifiedAt: true,
      questClearEvidence: false,
      questCelebration: "verified_result",
    });

    const response = await PATCH(new Request("http://localhost/api/quests/quest-1", { method: "PATCH", body: JSON.stringify({ status: "complete" }) }), { params: Promise.resolve({ id: "quest-1" }) });

    expect(response.status).toBe(200);
    expect(runDestinyServerLogic).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "complete" }));
  });
});
