import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = path.join(process.cwd(), "src", "app", "api");
const guardPatterns = [/getClaims\s*\(/, /getUser\s*\(/, /requireWorkspaceClient\s*\(/];
const allowlist = new Map([
  [
    "src/app/api/integrations/google/start/route.ts",
    "Interactive OAuth entrypoint; the proxy preserves the requested URL through the login redirect and the Edge Function validates the authenticated session.",
  ],
  [
    "src/app/api/version/route.ts",
    "GET-only fail-closed P1 production provenance verification prior to authentication; payload is exactly sha, tree, builtAt, and env, with no secrets, tokens, or customer data; authorized by D-MVP-RECOVERY-1B.",
  ],
]);

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.name === "route.ts") files.push(fullPath);
  }
  return files;
}

describe("API route authentication census", () => {
  it("requires every protected API route to authenticate inside its handler", async () => {
    const routes = await walk(apiRoot);
    const missing: string[] = [];

    for (const route of routes) {
      const relative = path.relative(process.cwd(), route).split(path.sep).join("/");
      const source = await readFile(route, "utf8");
      const justifiedException = allowlist.get(relative);
      if (!guardPatterns.some((pattern) => pattern.test(source)) && !justifiedException) {
        missing.push(relative);
      }
    }

    expect(
      missing.sort(),
      `API route files missing an in-route auth guard:\n${missing.sort().join("\n")}`,
    ).toEqual([]);
  });

  it("requires every exception to carry a written justification", () => {
    for (const [route, justification] of allowlist) {
      expect(justification.trim().length, `${route} needs a written authentication exception justification.`).toBeGreaterThan(40);
    }
  });
});
