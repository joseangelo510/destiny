import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const repositoryRoot = path.resolve(productRoot, "..");
const specificationPath = path.join(productRoot, "qa", "specs", "edge-function-negative-authorization.md");

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

describe("Edge Function negative authorization harness", () => {
  it("runs the real local Edge runtime in the disposable GitHub gate", async () => {
    const workflow = await readFile(path.join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8");
    const gate = await readFile(path.join(productRoot, "scripts", "qa-gate.mjs"), "utf8");

    expect(workflow).toContain("run: pnpm gate");
    expect(gate).toContain('run(supabaseBin, [');
    expect(gate).toContain('"start"');
    expect(gate).not.toContain('"edge-runtime"');
  });

  it("requires a cross-tenant or unauthenticated negative request for every privileged function", async () => {
    expect(await exists(specificationPath)).toBe(true);
    const suite = await readFile(
      path.join(productRoot, "qa", "isolation", "two-tenant.integration.test.ts"),
      "utf8",
    );
    const paths = [
      "delete-account",
      "google-oauth-callback",
      "google-oauth-start",
      "google-sync",
      "process-audit",
      "rank-digest",
      "rank-tracker-refresh",
      "webflow-connect",
      "webflow-draft",
      "wordpress-connect",
      "wordpress-draft",
      "wordpress-reconcile",
    ];

    expect(suite).toContain("verifyPrivilegedEdgeFunctionDenials");
    for (const functionName of paths) {
      expect(suite, `${functionName} needs an executable negative request.`)
        .toContain(`/functions/v1/${functionName}`);
    }
  });
});
