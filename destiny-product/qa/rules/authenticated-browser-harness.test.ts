import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const repositoryRoot = path.resolve(productRoot, "..");
const fixtureScript = path.join(productRoot, "scripts", "qa-browser-fixture.mjs");
const gateRunner = path.join(productRoot, "scripts", "qa-gate.mjs");
const browserJourney = path.join(productRoot, "qa", "e2e", "local-authenticated.spec.ts");
const productionJourney = path.join(productRoot, "qa", "e2e", "prod-readonly.spec.ts");

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

describe("authenticated local browser harness", () => {
  it("keeps disposable Supabase alive through the authenticated browser journey", async () => {
    const workflow = await readFile(path.join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8");
    const gate = await readFile(gateRunner, "utf8");
    const prepare = gate.indexOf('runPnpm(["qa:browser-fixture"]');
    const browser = gate.indexOf('runPnpm(["test:e2e"]');
    const teardown = gate.indexOf('run(supabaseBin, ["stop", "--no-backup"]');

    expect(prepare).toBeGreaterThan(-1);
    expect(browser).toBeGreaterThan(prepare);
    expect(teardown).toBeGreaterThan(browser);
    expect(workflow).toContain("Destroy disposable Supabase isolation stack");
    expect(workflow).toContain("if: always()");
  });

  it("creates loopback-only shared-user state and exports only local CI paths", async () => {
    const packageJson = JSON.parse(await readFile(path.join(productRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["qa:browser-fixture"]).toBe("node scripts/qa-browser-fixture.mjs");
    expect(await exists(fixtureScript)).toBe(true);

    const fixture = await readFile(fixtureScript, "utf8");
    expect(fixture).toContain("assertLoopbackSupabaseUrl");
    expect(fixture).toContain("create_organization");
    expect(fixture).toContain("organization_members");
    expect(fixture).toContain("QA_AUTH_STATE");
    expect(fixture).toContain("GITHUB_ENV");
  });

  it("switches real website state and denies an authenticated outsider audit read", async () => {
    expect(await exists(browserJourney)).toBe(true);
    const journey = await readFile(browserJourney, "utf8");

    expect(journey).toContain("data-workspace-website");
    expect(journey).toContain("data-site-switch");
    expect(journey).toContain("outsiderAuditId");
    expect(journey).toContain("/api/audits/");
  });

  it("keeps the production read-only suite out of disposable local browser runs", async () => {
    const journey = await readFile(productionJourney, "utf8");

    expect(journey).toContain('process.env.QA_PROD_READONLY === "1"');
  });
});
