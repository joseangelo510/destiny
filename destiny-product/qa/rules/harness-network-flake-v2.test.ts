import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
async function loadNetworkModule() {
  const modulePath = "../../scripts/harness/" + "network-policy.mjs";
  return import(/* @vite-ignore */ modulePath);
}

async function loadFlakeModule() {
  const modulePath = "../../scripts/harness/" + "flake.mjs";
  return import(/* @vite-ignore */ modulePath);
}

describe("network and flake controls", () => {
  it("fails closed for undeclared or out-of-mode network traffic", async () => {
    const { assertNetworkRequestAllowed, validateNetworkMode } = await loadNetworkModule();
    expect(validateNetworkMode(undefined)).toEqual(["QA_NETWORK_MODE must be declared."]);
    expect(validateNetworkMode("mocked")).toEqual([]);
    expect(() => assertNetworkRequestAllowed("https://api.example.com", "mocked")).toThrow(
      "mocked tests may not access network origin https://api.example.com",
    );
    expect(() => assertNetworkRequestAllowed("http://127.0.0.1:54321", "local-isolated")).not.toThrow();
    expect(() => assertNetworkRequestAllowed("https://destiny-seo.replit.app/api/version", "staging-readonly", "POST"))
      .toThrow("staging-readonly permits GET, HEAD, and OPTIONS only");
  });

  it("keeps fail-then-pass tests red and records them as flaky", async () => {
    const { classifyTestAttempts } = await loadFlakeModule();
    expect(classifyTestAttempts([{ status: "fail" }, { status: "pass" }])).toEqual({
      flaky: true,
      gateStatus: "fail",
      retries: 1,
    });
    expect(classifyTestAttempts([{ status: "pass" }])).toEqual({
      flaky: false,
      gateStatus: "pass",
      retries: 0,
    });
  });

  it("requires bounded quarantine ownership", async () => {
    const { validateQuarantine } = await loadFlakeModule();
    expect(validateQuarantine({
      owner: "joseangelo510",
      reason: "Browser engine defect",
      expiresAt: "2026-09-01T00:00:00Z",
    }, new Date("2026-08-27T00:00:00Z"))).toEqual([]);
    expect(validateQuarantine({ reason: "later" }, new Date("2026-08-27T00:00:00Z")))
      .toEqual(expect.arrayContaining([
        "Quarantine requires an owner.",
        "Quarantine requires an expiry.",
      ]));
    expect(validateQuarantine({}, new Date("2026-08-27T00:00:00Z")))
      .toContain("Quarantine requires a reason.");
  });

  it("enforces every declared network mode", async () => {
    const { assertNetworkRequestAllowed, validateNetworkMode } = await loadNetworkModule();
    expect(validateNetworkMode("unknown")).toEqual(["Unknown QA_NETWORK_MODE: unknown."]);
    expect(() => assertNetworkRequestAllowed("https://example.com/a", "unknown")).toThrow("Unknown QA_NETWORK_MODE: unknown.");
    expect(() => assertNetworkRequestAllowed("http://localhost:9999/a", "local-isolated", "post")).not.toThrow();
    expect(() => assertNetworkRequestAllowed("https://example.com/a", "local-isolated")).toThrow(/loopback only/);
    expect(() => assertNetworkRequestAllowed("https://example.com/a", "staging-readonly", "head")).not.toThrow();
    const before = process.env.QA_LIVE_AUTHORIZED;
    delete process.env.QA_LIVE_AUTHORIZED;
    expect(() => assertNetworkRequestAllowed("https://example.com/a", "authorized-live")).toThrow(/QA_LIVE_AUTHORIZED=1/);
    process.env.QA_LIVE_AUTHORIZED = "1";
    expect(() => assertNetworkRequestAllowed("https://example.com/a", "authorized-live", "POST")).not.toThrow();
    if (before === undefined) delete process.env.QA_LIVE_AUTHORIZED;
    else process.env.QA_LIVE_AUTHORIZED = before;
  });

  it("never converts any failed attempt into green", async () => {
    const { classifyTestAttempts } = await loadFlakeModule();
    expect(classifyTestAttempts([{ status: "pass" }, { status: "fail" }])).toEqual({ flaky: false, gateStatus: "fail", retries: 1 });
    expect(classifyTestAttempts([{ status: "fail" }, { status: "fail" }]).gateStatus).toBe("fail");
    expect(classifyTestAttempts([])).toEqual({ flaky: false, gateStatus: "pass", retries: 0 });
  });

  it("disables Playwright retries in every environment", async () => {
    const config = await readFile(path.join(process.cwd(), "playwright.config.ts"), "utf8");
    expect(config).toMatch(/retries:\s*0/);
    expect(config).not.toMatch(/retries:\s*process\.env\.CI/);
  });

  it("rejects invalid and expired quarantines", async () => {
    const { validateQuarantine } = await loadFlakeModule();
    const now = new Date("2026-08-27T00:00:00Z");
    expect(validateQuarantine({ owner: "a", reason: "b", expiresAt: "later" }, now)).toContain("Quarantine expiry is invalid.");
    expect(validateQuarantine({ owner: "a", reason: "b", expiresAt: "2026-08-26T00:00:00Z" }, now)).toContain("Quarantine has expired.");
  });

  it("fails closed for missing browser fixtures instead of skipping gates", async () => {
    const local = await readFile(path.join(process.cwd(), "qa/e2e/local-authenticated.spec.ts"), "utf8");
    const production = await readFile(path.join(process.cwd(), "qa/e2e/prod-readonly.spec.ts"), "utf8");
    const config = await readFile(path.join(process.cwd(), "playwright.config.ts"), "utf8");
    const disabledCall = ["test", ".skip", "("].join("");
    expect(local).not.toContain(disabledCall);
    expect(production).not.toContain(disabledCall);
    expect(local).toContain("if (!fixture) throw new Error");
    expect(production).toContain("if (!authenticated) throw new Error");
    expect(config).toContain("prod-readonly.spec.ts");
    expect(config).toContain("testIgnore");
  });
});
