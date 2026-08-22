import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifySourceFile,
  evaluateFileLengths,
  hasNonLatinLetters,
} from "../../scripts/qa-repository-policy.mjs";

const root = process.cwd();

async function exists(relativePath: string) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

describe("Fable Step Zero repository policy", () => {
  it("wires every repository policy into the same one-command gate", async () => {
    const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const gate = await readFile(path.join(root, "scripts/qa-gate.mjs"), "utf8");

    expect(packageJson.scripts?.gate).toBe("node scripts/qa-gate.mjs");
    expect(packageJson.scripts?.["qa:repository"]).toBe("node scripts/qa-repository-policy.mjs");
    expect(packageJson.scripts?.["qa:commits"]).toBe("node scripts/qa-commit-policy.mjs");
    expect(packageJson.scripts?.["qa:deploy-log"]).toBe("node scripts/qa-deploy-log.mjs");
    for (const command of ["qa:repository", "qa:commits", "qa:deploy-log"]) {
      expect(gate).toContain(command);
    }
    for (const file of [
      "file-length-baseline.json",
      "commit-policy.json",
      "DB_EXEMPTIONS.md",
      "DEPLOY_LOG.md",
      "qa/decisions/2026-08-22-fable-step-zero-repository-policy.md",
    ]) expect(await exists(file), `${file} must be checked in`).toBe(true);
  });

  it("enforces Fable's 500/800 baseline ratchet without counting exemptions", () => {
    expect(classifySourceFile("src/app/new/page.tsx")).toBe("production");
    expect(classifySourceFile("src/app/new/page.test.tsx")).toBe("test");
    for (const exempt of [
      "src/app/globals.css",
      "src/lib/supabase/database.types.ts",
      "supabase/migrations/20260822000000_example.sql",
      "pnpm-lock.yaml",
      "vendor/copied.js",
      "qa/fixtures/data.json",
      "qa/snapshots/view.snap",
    ]) expect(classifySourceFile(exempt), exempt).toBe(null);

    const result = evaluateFileLengths({
      files: [
        { path: "src/app/new/page.tsx", lines: 501 },
        { path: "src/lib/legacy.ts", lines: 700 },
        { path: "src/lib/shrinking.ts", lines: 550 },
        { path: "qa/rules/new.test.ts", lines: 801 },
      ],
      baseline: {
        policyVersion: 1,
        productionMax: 500,
        testMax: 800,
        files: { "src/lib/legacy.ts": 699, "src/lib/shrinking.ts": 600 },
      },
    });

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("src/app/new/page.tsx"),
      expect.stringContaining("src/lib/legacy.ts"),
      expect.stringContaining("qa/rules/new.test.ts"),
    ]));
    expect(result.nextBaseline.files["src/lib/shrinking.ts"]).toBe(550);
  });

  it("governs non-Latin developer strings while leaving ordinary English and symbols alone", () => {
    expect(hasNonLatinLetters("Destiny found your next opportunity ✓")).toBe(false);
    expect(hasNonLatinLetters("Votre stratégie est prête")).toBe(false);
    expect(hasNonLatinLetters("Стратегия готова")).toBe(true);
    expect(hasNonLatinLetters("戦略の準備ができました")).toBe(true);
  });

  it("registers the English-only rule only on governed developer-authored paths", async () => {
    const config = await readFile(path.join(root, "eslint.config.mjs"), "utf8");
    expect(config).toContain("destiny/english-only");
    for (const governed of ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/lib/notifications/**/*.{ts,tsx}"]) {
      expect(config).toContain(governed);
    }
    expect(config).toContain("i18n-ok:");
  });
});
