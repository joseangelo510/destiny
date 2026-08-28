import { describe, expect, it } from "vitest";
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
  });
});
