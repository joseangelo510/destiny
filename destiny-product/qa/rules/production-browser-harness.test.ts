import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("production-build browser verification", () => {
  it("uses the already-built application in CI without suppressing browser errors", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("QA_PROD_READONLY", "");
    vi.resetModules();
    const { default: config } = await import("../../playwright.config");
    expect(config.webServer).toMatchObject({ command: "pnpm start --hostname 127.0.0.1 --port 4173", reuseExistingServer: false });
    const gate = await readFile("scripts/qa-gate.mjs", "utf8");
    const build = gate.indexOf('runPnpm(["build"]');
    expect(build).toBeGreaterThan(-1);
    expect(gate.indexOf('runPnpm(["test:e2e"]')).toBeGreaterThan(build);
  });

  it("keeps the local development server for interactive test development", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("QA_PROD_READONLY", "");
    vi.resetModules();
    const { default: config } = await import("../../playwright.config");
    expect(config.webServer).toMatchObject({ command: "pnpm dev --hostname 127.0.0.1 --port 4173", reuseExistingServer: true });
  });
});
