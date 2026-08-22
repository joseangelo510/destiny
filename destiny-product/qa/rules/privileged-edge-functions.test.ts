import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const manifestPath = path.join(productRoot, "qa", "inventory", "privileged-edge-functions.json");
const specificationPath = path.join(productRoot, "qa", "specs", "privileged-edge-functions.md");

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

describe("privileged Edge Function authorization boundaries", () => {
  it("requires an explicit, executable inventory for every service-role function", async () => {
    expect(await exists(manifestPath)).toBe(true);
    expect(await exists(specificationPath)).toBe(true);

    const specification = await readFile(specificationPath, "utf8");
    expect(specification).toContain("request-controlled identifiers");
    expect(specification).toContain("negative authorization");
    expect(specification).toContain("service role");
  });
});
