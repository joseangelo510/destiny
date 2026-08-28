import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Replit configuration", () => {
  it("uses table metadata and keeps deployment installs pnpm-only", async () => {
    const replit = await readFile(path.join(root, "..", ".replit"), "utf8");

    expect(replit).not.toMatch(/\[\[workflows\.workflow\.metadata\]\]/);
    expect(replit).toMatch(/\[workflows\.workflow\.metadata\]/);
    expect(replit).not.toMatch(/\bnpm\s+(?:ci|install)\b/);
  });
});
