import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const repositoryRoot = path.resolve(productRoot, "..");
const workflowPath = path.join(repositoryRoot, ".github", "workflows", "ci.yml");
const shadowWorkflowPath = path.join(productRoot, ".github", "workflows", "ci.yml");

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
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
      "pnpm qa:inventory",
      "git diff --exit-code -- qa/inventory",
      "pnpm qa:migrations",
      "pnpm lint",
      "pnpm test",
      "pnpm build",
      "playwright install --with-deps chromium",
      "pnpm test:e2e",
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
    expect(
      await exists(shadowWorkflowPath),
      "Found shadow workflow destiny-product/.github/workflows/ci.yml; GitHub never executes workflows in subdirectories.",
    ).toBe(false);
  });
});
