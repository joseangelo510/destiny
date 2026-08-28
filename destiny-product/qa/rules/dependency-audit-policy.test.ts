import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function loadAuditPolicy() {
  const modulePath = "../../scripts/harness/" + "ratchet.mjs";
  return import(/* @vite-ignore */ modulePath);
}

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
    expect(auditGate).toContain("validateAuditExceptions");
    expect(auditGate).toContain("audit-exceptions.v2.json");
    expect(auditGate).toContain("audit/exceptions.json");
  });

  it("requires exact, owned, tested, and unexpired audit exceptions", async () => {
    const { validateAuditExceptions } = await loadAuditPolicy();
    const exception = {
      ghsa: "GHSA-w3rx-r6r6-pgpr",
      owner: "platform-security",
      reason: "Bundled dependency is guarded at the export boundary.",
      boundaryTest: "qa/rules/document-export-security.test.ts",
      expiresAt: "2026-09-05T00:00:00.000Z",
    };
    expect(validateAuditExceptions({ schemaVersion: "2.0.0", exceptions: [exception] }, {
      ignoredGhsas: [exception.ghsa],
      testFiles: new Set([exception.boundaryTest]),
      now: new Date("2026-08-28T00:00:00.000Z"),
    })).toEqual([]);
    expect(validateAuditExceptions({ schemaVersion: "2.0.0", exceptions: [
      exception,
      { ...exception, owner: "", boundaryTest: "missing.test.ts", expiresAt: "2026-08-27T00:00:00.000Z" },
    ] }, {
      ignoredGhsas: [exception.ghsa, "GHSA-5p2g-fcmc-qvqq"],
      testFiles: new Set([exception.boundaryTest]),
      now: new Date("2026-08-28T00:00:00.000Z"),
    })).toEqual(expect.arrayContaining([
      "Audit exception is duplicated: GHSA-w3rx-r6r6-pgpr.",
      "Audit exception GHSA-w3rx-r6r6-pgpr requires an owner.",
      "Audit exception GHSA-w3rx-r6r6-pgpr boundary test does not exist: missing.test.ts.",
      "Audit exception GHSA-w3rx-r6r6-pgpr has expired.",
      "Ignored GHSA lacks a typed exception: GHSA-5p2g-fcmc-qvqq.",
    ]));
  });

  it("fails closed for malformed policies, identities, metadata, and asymmetric mappings", async () => {
    const { validateAuditExceptions } = await loadAuditPolicy();
    const now = new Date("2026-08-28T00:00:00.000Z");
    expect(validateAuditExceptions(null)).toEqual(["Audit exception policy must be an object."]);
    expect(validateAuditExceptions([])).toEqual(["Audit exception policy must be an object."]);
    expect(validateAuditExceptions({ schemaVersion: "1.0.0" })).toEqual([
      "Audit exception policy schemaVersion must be 2.0.0.",
      "Audit exception policy requires an exceptions array.",
    ]);
    expect(validateAuditExceptions({ schemaVersion: "2.0.0", exceptions: [{
      ghsa: "xGHSA-w3rx-r6r6-pgpr",
      owner: "",
      reason: "",
      boundaryTest: "",
      expiresAt: "later",
    }] }, { now })).toEqual(expect.arrayContaining([
      "Audit exception GHSA is invalid: xGHSA-w3rx-r6r6-pgpr.",
      "Audit exception xGHSA-w3rx-r6r6-pgpr requires an owner.",
      "Audit exception xGHSA-w3rx-r6r6-pgpr requires a reason.",
      "Audit exception xGHSA-w3rx-r6r6-pgpr boundary test does not exist: <missing>.",
      "Audit exception xGHSA-w3rx-r6r6-pgpr expiry is invalid.",
      "Typed audit exception is not ignored by pnpm: xGHSA-w3rx-r6r6-pgpr.",
    ]));
    const expiring = {
      ghsa: "GHSA-w3rx-r6r6-pgpr",
      owner: "platform-security",
      reason: "Bounded exception.",
      boundaryTest: "qa/rules/document-export-security.test.ts",
      expiresAt: now.toISOString(),
    };
    expect(validateAuditExceptions({ schemaVersion: "2.0.0", exceptions: [expiring] }, {
      ignoredGhsas: [],
      testFiles: new Set([expiring.boundaryTest]),
      now,
    })).toEqual(expect.arrayContaining([
      "Audit exception GHSA-w3rx-r6r6-pgpr has expired.",
      "Typed audit exception is not ignored by pnpm: GHSA-w3rx-r6r6-pgpr.",
    ]));
  });
});
