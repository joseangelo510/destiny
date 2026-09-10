import { describe, expect, it, vi } from "vitest";
import { refreshGovernance } from "../../scripts/governance-refresh.mjs";

const repository = { full_name: "joseangelo510/destiny" };
const head = "a".repeat(40);
const pr = { state: "open", head: { sha: head }, base: { sha: "b".repeat(40), repo: repository }, updated_at: "2026-09-05T10:00:00Z", body: "", labels: [], draft: false };
const context = { files: [], labels: [], labelActors: {}, headSha: head, body: "" };
function fixture(fresh = pr) {
  let reads = 0;
  const api = vi.fn(async (route, method = "GET") => {
    if (route === "/pulls/115") return reads++ === 0 ? pr : fresh;
    if (route === `/statuses/${head}` && method === "POST") return { id: 42 };
    throw new Error(`Unexpected ${method} ${route}`);
  });
  return { api, loadContext: vi.fn(async () => context), repository, mode: "policy", number: 115, detailsUrl: "https://github.com/joseangelo510/destiny/actions/runs/123" };
}

describe("trusted governance refresh", () => {
  it("sets the required check pending before any authority reads, then succeeds", async () => {
    const f = fixture();
    await refreshGovernance(f);
    expect(f.api.mock.calls[1]).toEqual([`/statuses/${head}`, "POST", expect.objectContaining({ context: "policy-guard", state: "pending" })]);
    expect(f.api).toHaveBeenLastCalledWith(`/statuses/${head}`, "POST", expect.objectContaining({ state: "success" }));
  });
  it("refreshes independently of old Actions suites and writes no custom check runs", async () => {
    const f = fixture();
    await refreshGovernance(f);
    await refreshGovernance(f);
    expect(f.api.mock.calls.filter((call) => call[1] === "POST").map((call) => call[2]?.state)).toEqual(["pending", "success", "pending", "success"]);
    expect(f.api.mock.calls.every((call) => !call[0].includes("check-runs"))).toBe(true);
  });
  it("never writes success after a push, metadata edit, draft conversion or close", async () => {
    for (const change of [{ head: { sha: "c".repeat(40) } }, { body: "changed" }, { labels: [{ name: "changed" }] }, { draft: true }, { state: "closed" }, { base: { ...pr.base, sha: "d".repeat(40) } }]) {
      const f = fixture({ ...pr, ...change });
      await refreshGovernance(f);
      expect(f.api.mock.calls.some((call) => call[2]?.state === "success" || call[2]?.state === "failure")).toBe(false);
    }
  });
  it("keeps pending if approval history changes during evaluation", async () => {
    const f = fixture();
    f.loadContext.mockResolvedValueOnce(context).mockResolvedValueOnce({ ...context, labels: ["cto-approved"] });
    await refreshGovernance(f);
    expect(f.api.mock.calls.some((call) => call[2]?.state === "success" || call[2]?.state === "failure")).toBe(false);
  });
  it("fails operational errors without completing the required check", async () => {
    const f = fixture();
    f.loadContext.mockRejectedValue(new Error("GitHub unavailable"));
    await expect(refreshGovernance(f)).rejects.toThrow("GitHub unavailable");
    expect(f.api.mock.calls.some((call) => call[2]?.state === "success" || call[2]?.state === "failure")).toBe(false);
  });
  it("publishes invalid authority as failure and fails the worker for alerts", async () => {
    const f = fixture();
    f.loadContext.mockResolvedValue({ ...context, files: ["HARNESS_POLICY.md"], labels: ["cto-approved"], labelActors: { "cto-approved": "not-the-owner" } });
    await expect(refreshGovernance(f)).rejects.toThrow("must be applied");
    expect(f.api).toHaveBeenLastCalledWith(`/statuses/${head}`, "POST", expect.objectContaining({ state: "failure" }));
  });
});
