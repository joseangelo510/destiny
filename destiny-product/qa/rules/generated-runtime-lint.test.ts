import { ESLint } from "eslint";
import { expect, it } from "vitest";

it("excludes disposable CLI runtime output while retaining application lint rules", async () => {
  const lint = new ESLint();
  expect(await lint.isPathIgnored("supabase/.temp/start-secrets/supabase_edge_runtime_destiny-isolation/main/index.ts")).toBe(true);
  expect(await lint.isPathIgnored("src/lib/billing/plans.ts")).toBe(false);
  const results = await lint.lintText("var billingLimit = 1; billingLimit += 1;", { filePath: "src/lib/billing/lint-probe.ts" });
  expect(results[0].messages.some((message) => message.ruleId === "no-var")).toBe(true);
});
