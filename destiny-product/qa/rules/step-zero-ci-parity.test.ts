import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const repositoryRoot = path.resolve(productRoot, "..");

describe("Step Zero local and CI parity", () => {
  it("keeps GitHub on the exact runner used by local development", async () => {
    const packageJson = JSON.parse(await readFile(path.join(productRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const workflow = await readFile(path.join(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
    const invocations = workflow.match(/run:\s*pnpm gate\b/g) ?? [];

    expect(packageJson.scripts?.gate).toBe("node scripts/qa-gate.mjs");
    expect(invocations).toHaveLength(1);
    expect(workflow).not.toMatch(/pnpm (?:lint|test|build|test:e2e)\b/);
  });
});
