import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Replit configuration", () => {
  it("uses table metadata and keeps deployment installs pnpm-only in CI mode", async () => {
    const replit = await readFile(path.join(root, "..", ".replit"), "utf8");

    expect(replit).not.toMatch(/\[\[workflows\.workflow\.metadata\]\]/);
    expect(replit).toMatch(/\[workflows\.workflow\.metadata\]/);
    expect(replit).not.toMatch(/\bnpm\s+(?:ci|install)\b/);
    expect(replit).toMatch(
      /build\s*=\s*"cd destiny-product && CI=true pnpm install --frozen-lockfile && pnpm run build"/,
    );
    expect(replit).not.toMatch(/pnpm run start --/);
    expect(replit).toMatch(
      /run\s*=\s*"cd destiny-product && pnpm exec next start -H 0\.0\.0\.0 -p 3000"/,
    );
  });
});
