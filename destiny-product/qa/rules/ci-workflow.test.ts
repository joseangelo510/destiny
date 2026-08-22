import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const repositoryRoot = path.resolve(productRoot, "..");
const workflowPath = path.join(repositoryRoot, ".github", "workflows", "ci.yml");
const workflowDirectory = path.join(productRoot, ".github", "workflows");
const pullRequestTemplatePath = path.join(repositoryRoot, ".github", "pull_request_template.md");
const shadowPullRequestTemplatePath = path.join(productRoot, ".github", "pull_request_template.md");
const gateRunnerPath = path.join(productRoot, "scripts", "qa-gate.mjs");
const browserFixturePath = path.join(productRoot, "scripts", "qa-browser-fixture.mjs");

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function filesBelow(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await filesBelow(fullPath));
      else files.push(fullPath);
    }
    return files;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw cause;
  }
}

describe("GitHub harness workflow", () => {
  it("runs the complete Destiny gate from the repository root", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const requiredFragments = [
      "ci:",
      "working-directory: destiny-product",
      "cache-dependency-path: destiny-product/pnpm-lock.yaml",
      "pnpm install --frozen-lockfile",
      "pnpm gate",
      "actions/upload-artifact@",
      "retention-days: 14",
    ];

    for (const fragment of requiredFragments) {
      expect(
        workflow,
        `Expected repository-root .github/workflows/ci.yml to include ${JSON.stringify(fragment)}.`,
      ).toContain(fragment);
    }
    expect(workflow).toMatch(/node-version:\s*22/);
    expect(workflow).toMatch(/pnpm\/action-setup@[\w.-]+[\s\S]*version:\s*11\.9\.0/);
  });

  it("does not hide a shadow workflow below the GitHub repository root", async () => {
    const shadowWorkflows = (await filesBelow(workflowDirectory))
      .map((file) => path.relative(productRoot, file).split(path.sep).join("/"));
    expect(
      shadowWorkflows,
      `Found shadow workflows below destiny-product; GitHub never executes workflows in subdirectories:\n${shadowWorkflows.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the pull-request evidence checklist where GitHub can render it", async () => {
    expect(
      await exists(pullRequestTemplatePath),
      "Expected the harness pull-request template at repository-root .github/pull_request_template.md.",
    ).toBe(true);
    expect(
      await exists(shadowPullRequestTemplatePath),
      "Found an inert pull-request template below destiny-product/.github; move it to the repository root.",
    ).toBe(false);

    const template = await readFile(pullRequestTemplatePath, "utf8");
    expect(template).toContain("Red test commit");
    expect(template).toContain("pnpm gate");
    expect(template).toContain("Site isolation");
  });

  it("uses one local and CI command for the complete disposable harness", async () => {
    const packageJson = JSON.parse(await readFile(path.join(productRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const workflow = await readFile(workflowPath, "utf8");

    expect(packageJson.scripts?.gate).toBe("node scripts/qa-gate.mjs");
    expect(await exists(gateRunnerPath)).toBe(true);
    expect(workflow).toContain("run: pnpm gate");

    const gate = await readFile(gateRunnerPath, "utf8");
    for (const fragment of [
      "qa:inventory",
      "git",
      "diff",
      "qa:migrations",
      "lint",
      "test",
      "qa:isolation",
      "qa:browser-fixture",
      "build",
      "playwright",
      "test:e2e",
      "supabase",
      "stop",
      "--no-backup",
      "finally",
    ]) expect(gate).toContain(fragment);

    const fixture = await readFile(browserFixturePath, "utf8");
    expect(fixture).toContain("QA_BROWSER_ENV_FILE");
  });
});
