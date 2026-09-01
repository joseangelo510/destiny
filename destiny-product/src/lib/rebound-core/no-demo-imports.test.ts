import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name))
    : [join(directory, entry.name)]));
  return nested.flat().filter((file) => [".ts", ".tsx"].includes(extname(file)) && !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"));
}

describe("redesign production source", () => {
  it("does not import documentation mockups or embed their demo business data", async () => {
    const roots = [
      new URL("../../app/app/home", import.meta.url).pathname,
      new URL("../../components/rebound-core", import.meta.url).pathname,
      new URL(".", import.meta.url).pathname,
    ];
    const files = (await Promise.all(roots.map(sourceFiles))).flat();
    const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
    expect(source).not.toMatch(/docs\/design\/redesign-v1|rebound-notes-v5\.html|rebound-five-pillars\.html/);
    expect(source).not.toMatch(/Maya.?s Pottery|ClayCraft|pottery glaze|kiln guide/i);
  });
});
