import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const repositoryRoot = path.resolve(productRoot, "..");

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

describe("disposable three-site isolation harness", () => {
  it("pins the local Supabase CLI and exposes an explicit Docker-only lane", async () => {
    const packageJson = JSON.parse(await readFile(path.join(productRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.supabase).toBe("2.115.0");
    expect(packageJson.scripts?.["test:isolation"]).toBe("vitest run --config vitest.isolation.config.mjs");
    expect(packageJson.scripts?.["qa:isolation"]).toBe("node scripts/qa-isolation.mjs");
    expect(await exists(path.join(productRoot, "vitest.isolation.config.mjs"))).toBe(true);
    expect(await exists(path.join(productRoot, "supabase", "config.toml"))).toBe(true);
  });

  it("keeps Docker-dependent isolation tests out of the default unit lane", async () => {
    const config = await readFile(path.join(productRoot, "vitest.config.mjs"), "utf8");
    expect(config).toContain('"qa/isolation/**"');
  });

  it("requires the root CI job to start, run, and always destroy the disposable stack", async () => {
    const workflow = await readFile(path.join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8");
    for (const fragment of [
      "pnpm exec supabase start",
      "pnpm qa:isolation",
      "pnpm exec supabase stop --no-backup",
      "if: always()",
    ]) {
      expect(workflow, `Expected the repository-root CI workflow to include ${fragment}.`).toContain(fragment);
    }
  });

  it("registers the high-risk website-scoped tables and the executable audit", async () => {
    const runnerPath = path.join(productRoot, "scripts", "qa-isolation.mjs");
    expect(await exists(runnerPath)).toBe(true);
    const runner = await readFile(runnerPath, "utf8");
    for (const table of [
      "websites",
      "audits",
      "keyword_decisions",
      "article_drafts",
      "publishing_plans",
      "publishing_schedule_items",
      "interviews",
      "interlink_runs",
      "notifications",
    ]) {
      expect(runner, `Expected the three-site matrix to register ${table}.`).toContain(`\"${table}\"`);
    }
    expect(runner).toContain("site-isolation-audit.sql");
    expect(runner).toContain("assertLoopbackSupabaseUrl");
  });

  it("runs a three-site isolation cycle instead of relying on one tenant pair", async () => {
    const matrix = await readFile(
      path.join(productRoot, "qa", "isolation", "two-tenant.integration.test.ts"),
      "utf8",
    );

    expect(matrix).toContain('createTenant("C")');
    expect(matrix).toContain("verifyTenantBoundary(a, b)");
    expect(matrix).toContain("verifyTenantBoundary(b, c)");
    expect(matrix).toContain("verifyTenantBoundary(c, a)");
    expect(matrix).toContain("verifyBlendedPairRejection(b, c)");
  });

  it("provides offline CMS mocks and a smoke test for every supported handoff mode", async () => {
    const adapterPath = path.join(productRoot, "qa", "mocks", "cms-adapters.ts");
    const smokePath = path.join(productRoot, "qa", "mocks", "cms-adapters.test.ts");
    expect(await exists(adapterPath)).toBe(true);
    expect(await exists(smokePath)).toBe(true);

    const adapter = await readFile(adapterPath, "utf8");
    for (const provider of ["wordpress", "webflow", "wix"]) {
      expect(adapter).toContain(`\"${provider}\"`);
    }
    for (const forbiddenHost of [
      "clearcheck.app",
      "98junkit.com",
      "joseangelostudios.com",
    ]) {
      expect(adapter).toContain(forbiddenHost);
    }
    expect(adapter).toContain(".invalid");
    expect(adapter).not.toContain("fetch(");
  });
});
