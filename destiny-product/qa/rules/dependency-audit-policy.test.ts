import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("production dependency audit policy", () => {
  it("uses live pnpm 11 overrides for every fixable High advisory", async () => {
    const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      overrides?: Record<string, string>;
      pnpm?: unknown;
      scripts?: Record<string, string>;
    };
    const workspace = await readFile(path.join(root, "pnpm-workspace.yaml"), "utf8");
    const lockfile = await readFile(path.join(root, "pnpm-lock.yaml"), "utf8");

    expect(packageJson.pnpm).toBeUndefined();
    expect(packageJson.overrides).toEqual(expect.objectContaining({
      nanoid: "3.3.18",
      postcss: "8.5.23",
      sharp: "0.35.3",
    }));
    expect(packageJson.scripts?.["qa:audit"]).toBe("node scripts/qa-audit.mjs");
    expect(workspace).toMatch(/overrides:\s+[\s\S]*nanoid: 3\.3\.18[\s\S]*postcss: 8\.5\.23[\s\S]*sharp: 0\.35\.3/);
    expect(workspace).toContain("GHSA-w3rx-r6r6-pgpr");
    expect(workspace).toContain("GHSA-5p2g-fcmc-qvqq");
    expect(lockfile).not.toMatch(/sharp@0\.34\.5|postcss@8\.4\.31/);
    expect(lockfile).toContain("sharp@0.35.3");
    expect(lockfile).toContain("postcss@8.5.23");
  });

  it("keeps the network audit as a required release gate", async () => {
    const auditGate = await readFile(path.join(root, "scripts/qa-audit.mjs"), "utf8");
    expect(auditGate).toContain("audit");
    expect(auditGate).toContain("--prod");
    expect(auditGate).toContain("--audit-level=high");
  });
});
