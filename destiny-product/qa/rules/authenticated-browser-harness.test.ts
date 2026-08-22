import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const repositoryRoot = path.resolve(productRoot, "..");
const fixtureScript = path.join(productRoot, "scripts", "qa-browser-fixture.mjs");
const browserJourney = path.join(productRoot, "qa", "e2e", "local-authenticated.spec.ts");

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
    const prepare = workflow.indexOf("Prepare authenticated browser fixture");
    const browser = workflow.indexOf("Run browser journeys");
    const teardown = workflow.indexOf("Destroy disposable Supabase isolation stack");

    expect(prepare).toBeGreaterThan(-1);
    expect(browser).toBeGreaterThan(prepare);
    expect(teardown).toBeGreaterThan(browser);
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
});
