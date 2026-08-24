import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();

describe("build provenance policy", () => {
  it("runs the build-stamp writer explicitly before every production build", async () => {
    const packageJson = JSON.parse(await readFile(path.join(productRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.build).toBe(
      "node scripts/write-build-stamp.mjs && next build --webpack",
    );
    expect(packageJson.scripts?.prebuild).toBeUndefined();
  });
});
