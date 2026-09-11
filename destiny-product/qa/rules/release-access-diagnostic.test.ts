import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { diagnoseGitHubAccess } from "../../scripts/release-access-diagnostic.mjs";

const token = "test-secret-token-never-log";
const response = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
describe("read-only release access diagnostic", () => {
  it("makes exactly two fixed GET requests without redirects or writes", async () => {
    const fetchImpl = vi.fn(async () => response([]));
    await diagnoseGitHubAccess({ token, fetchImpl });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://api.github.com/rate_limit",
      "https://api.github.com/repos/joseangelo510/destiny/pulls?state=open&per_page=1",
    ]);
    for (const [, options] of fetchImpl.mock.calls) expect(options).toMatchObject({ method: "GET", redirect: "error", signal: expect.any(AbortSignal) });
  });
  it("reports quota numbers and primary rate-limit evidence without raw data", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response({ resources: { core: { limit: 1000, remaining: 0, used: 1000, reset: 1789119999, private: token } }, secret: token }))
      .mockResolvedValueOnce(response({ message: "API rate limit exceeded", documentation_url: "https://docs.github.com/rest/overview/rate-limits-for-the-rest-api", ignored: token }, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1789119999", authorization: token }));
    const result = await diagnoseGitHubAccess({ token, fetchImpl });
    expect(result[0].core).toEqual({ limit: 1000, remaining: 0, used: 1000, reset: 1789119999 });
    expect(result[1]).toMatchObject({ status: 403, message: "API rate limit exceeded", headers: { "x-ratelimit-remaining": "0" } });
    expect(JSON.stringify(result)).not.toContain(token);
  });
  it("distinguishes secondary and permission rejection messages", async () => {
    for (const [status, message, headers] of [[429, "secondary rate limit", { "retry-after": "60" }], [403, "Resource not accessible by integration", {}]] as const) {
      const result = await diagnoseGitHubAccess({ token, fetchImpl: async () => response({ message }, status, headers) });
      expect(result[1]).toMatchObject({ status, message, headers });
    }
  });
  it("redacts reflected credentials and excludes nonallowlisted fields", async () => {
    const result = await diagnoseGitHubAccess({ token, fetchImpl: async () => response({ message: token, documentation_url: `https://example.com/${token}`, arbitrary: "private" }, 403, { "x-github-request-id": token, "set-cookie": "private" }) });
    expect(JSON.stringify(result)).not.toMatch(/test-secret-token-never-log|private/);
    expect(result[1].message).toBe("[REDACTED]");
  });
  it("never prints an exception or unparseable response body", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error(token)).mockResolvedValueOnce(new Response(token, { status: 502 }));
    const result = await diagnoseGitHubAccess({ token, fetchImpl });
    expect(result[0].error).toBe("Request failed or timed out");
    expect(result[1]).toMatchObject({ status: 502, error: "Response was not JSON" });
    expect(JSON.stringify(result)).not.toContain(token);
  });
  it("rejects a missing token before making requests", async () => {
    const fetchImpl = vi.fn();
    await expect(diagnoseGitHubAccess({ token: "", fetchImpl })).rejects.toThrow("GITHUB_TOKEN required");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("keeps the workflow isolated from protected events and production", () => {
    const workflow = readFileSync("../.github/workflows/release-access-diagnostic.yml", "utf8");
    expect(workflow).toContain("branches: [codex/rebound-release-access-diagnostic]");
    expect(workflow).toContain("pull-requests: read");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toMatch(/pull_request:|workflow_run:|workflow_dispatch:|: write|environment:|secrets\.(?!GITHUB_TOKEN)/);
  });
});
