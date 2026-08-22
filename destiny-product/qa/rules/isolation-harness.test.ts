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

describe("disposable two-tenant isolation harness", () => {
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
      expect(runner, `Expected the two-tenant matrix to register ${table}.`).toContain(`\"${table}\"`);
    }
    expect(runner).toContain("site-isolation-audit.sql");
    expect(runner).toContain("assertLoopbackSupabaseUrl");
  });
});
