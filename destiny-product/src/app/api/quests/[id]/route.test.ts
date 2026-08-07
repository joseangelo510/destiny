import { beforeEach, describe, expect, it, vi } from "vitest";

const { runDestinyServerLogic, update, state } = vi.hoisted(() => ({
  runDestinyServerLogic: vi.fn(),
  update: vi.fn(),
  state: { taskType: "business_confirmation", approvedCount: 0 },
}));
const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

vi.mock("../../../../lib/logicaffeine-server", () => ({ runDestinyServerLogic }));
vi.mock("../../../../lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-zero" } } }) },
    from: (table: string) => table === "keyword_decisions"
      ? { select: () => ({ eq: () => ({ eq: async () => ({ count: state.approvedCount, error: null }) }) }) }
      : {
        select: (columns: string) => columns.startsWith("id,task_type,status,audit_id")
          ? { eq: () => ({ maybeSingle: async () => ({ data: { id: "quest-1", task_type: state.taskType, status: "todo", audit_id: "audit-1", week_number: 1 }, error: null }) }) }
          : { eq: () => ({ eq: async () => ({ data: [{ id: "quest-1", task_type: state.taskType, status: "todo" }], error: null }) }) },
        update,
      },
  }),
}));

import { PATCH } from "./route";

const complete = () => PATCH(new Request("http://localhost/api/quests/quest-1", { method: "PATCH", body: JSON.stringify({ status: "complete" }) }), { params: Promise.resolve({ id: "quest-1" }) });

describe("PATCH /api/quests/[id] LOGOS policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.taskType = "business_confirmation";
    state.approvedCount = 0;
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

    const response = await complete();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ celebration: "verified_result", transitionRuleId: "complete_business_confirmation" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "complete", verification_status: "verified", verification_method: "user_confirmation" }));
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"fallbacks":0'));
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"wasm_errors":0'));
  });

  it("fails closed on a LOGOS boundary error and performs no write", async () => {
    runDestinyServerLogic.mockRejectedValue(new Error("forced wasm failure"));

    const response = await complete();

    expect(response.status).toBe(503);
    expect(update).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"outcome":"fail_closed"'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"wasm_errors":1'));
  });

  it("rejects keyword review completion with only four approvals and performs no write", async () => {
    state.taskType = "keyword_review";
    state.approvedCount = 4;

    const response = await complete();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ approvedCount: 4, requiredApprovals: 5, remaining: 1 });
    expect(update).not.toHaveBeenCalled();
    expect(runDestinyServerLogic).not.toHaveBeenCalled();
  });

  it("accepts keyword review completion with five approvals", async () => {
    state.taskType = "keyword_review";
    state.approvedCount = 5;
    runDestinyServerLogic.mockResolvedValue({
      questTransitionAllowed: true,
      questTransitionRuleId: "complete_keyword_review",
      questVerificationStatus: "verified",
      questSetCompletedAt: true,
      questSetVerifiedAt: true,
      questClearEvidence: false,
      questCelebration: "task_complete",
    });

    const response = await complete();

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "complete" }));
  });
});
