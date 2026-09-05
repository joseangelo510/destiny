import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkKeywordCoverage } from "./keyword-coverage";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const setup = (payload: unknown) => {
  vi.stubEnv("DATAFORSEO_LOGIN", "fixture"); vi.stubEnv("DATAFORSEO_PASSWORD", "fixture");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
};
describe("indexed-page coverage", () => {
  it("uses actual site URLs and excludes unrelated domains", async () => {
    setup({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [{ type: "organic", title: "Guide", url: "https://example.com/guide" }, { type: "organic", title: "Unrelated", url: "https://other.com/guide" }] }] }] });
    const result = await checkKeywordCoverage("youtube strategy", "https://example.com/");
    expect(result.pages).toEqual([{ title: "Guide", url: "https://example.com/guide" }]);
    expect(result.checkedAt).toBeTruthy();
  });
  it("fails closed on provider error and missing result evidence", async () => {
    setup({ status_code: 20000, tasks: [{ status_code: 40501 }] });
    await expect(checkKeywordCoverage("youtube strategy", "https://example.com")).rejects.toThrow();
  });
});
