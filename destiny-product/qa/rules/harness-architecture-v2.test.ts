import { describe, expect, it } from "vitest";
async function loadArchitectureModule() {
  const modulePath = "../../scripts/harness/" + "architecture.mjs";
  return import(/* @vite-ignore */ modulePath);
}

describe("architecture fitness functions", () => {
  it("parses static, dynamic, export, and require dependencies", async () => {
    const { parseModuleSpecifiers } = await loadArchitectureModule();
    expect(parseModuleSpecifiers(`
      import value from "@/lib/value";
      export { thing } from "../thing";
      const lazy = import("./lazy");
      const old = require("./legacy");
    `)).toEqual(["@/lib/value", "../thing", "./lazy", "./legacy"]);
  });

  it("forbids lower layers from importing delivery implementations", async () => {
    const { evaluateArchitectureImports } = await loadArchitectureModule();
    expect(evaluateArchitectureImports([
      { file: "src/lib/seo/a.ts", specifier: "@/components/card" },
      { file: "src/components/card.tsx", specifier: "@/app/api/account/route" },
      { file: "src/app/api/a/route.ts", specifier: "@/app/api/b/route" },
    ])).toEqual([
      expect.stringContaining("src/lib/seo/a.ts"),
      expect.stringContaining("src/components/card.tsx"),
      expect.stringContaining("src/app/api/a/route.ts"),
    ]);
  });

  it("finds deterministic dependency cycles", async () => {
    const { detectDependencyCycles } = await loadArchitectureModule();
    expect(detectDependencyCycles(new Map([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["a"]],
      ["d", []],
    ]))).toEqual(["a -> b -> c -> a"]);
  });
});
