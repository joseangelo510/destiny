import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeDocxHtml } from "../../src/lib/word-document";

const root = process.cwd();

describe("Word export dependency security", () => {
  it("pins nanoid to the patched release in package metadata and both lockfiles", async () => {
    const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const pnpmLock = await readFile(path.join(root, "pnpm-lock.yaml"), "utf8");
    const npmLock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8")) as {
      packages?: Record<string, { version?: string }>;
    };

    expect(packageJson.pnpm?.overrides?.nanoid).toBe("3.3.18");
    expect(pnpmLock).not.toMatch(/nanoid@3\.3\.(?:16|17)(?:\W|$)/);
    expect(npmLock.packages?.["node_modules/nanoid"]?.version).toBe("3.3.18");
  });

  it("removes user-controlled image elements before HTML reaches html-to-docx", () => {
    const html = [
      '<main><h1>Safe heading</h1>',
      '<img src="data:image/jxl;base64,attacker-controlled" alt="unsafe">',
      '<IMG src="https://example.com/unsafe.heic">',
      '< img src="https://example.com/unsafe.icns">',
      '<p>Safe copy remains.</p></main>',
    ].join("");

    const sanitized = sanitizeDocxHtml(html);

    expect(sanitized).not.toMatch(/<\s*img\b/i);
    expect(sanitized).toContain("Safe heading");
    expect(sanitized).toContain("Safe copy remains.");
  });
});
