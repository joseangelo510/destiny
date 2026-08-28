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

  it("resolves aliases, relative modules, and packages", async () => {
    const { resolveLocalSpecifier } = await loadArchitectureModule();
    expect(resolveLocalSpecifier("src/lib/seo/a.ts", "@/lib/value")).toBe("src/lib/value");
    expect(resolveLocalSpecifier("src/lib/seo/a.ts", "../value")).toBe("src/lib/value");
    expect(resolveLocalSpecifier("src/lib/seo/a.ts", "react")).toBeNull();
  });

  it("covers edge and route boundaries while allowing inward dependencies", async () => {
    const { evaluateArchitectureImports } = await loadArchitectureModule();
    expect(evaluateArchitectureImports([
      { file: "supabase/functions/a/index.ts", specifier: "@/components/card" },
      { file: "src/app/api/a/route.js", specifier: "@/app/api/b/route" },
    ])).toHaveLength(2);
    expect(evaluateArchitectureImports([
      { file: "src/components/card.tsx", specifier: "@/lib/value" },
      { file: "src/app/page.tsx", specifier: "@/components/card" },
    ])).toEqual([]);
  });

  it("canonicalizes duplicate, rotated, and self cycles", async () => {
    const { detectDependencyCycles } = await loadArchitectureModule();
    expect(detectDependencyCycles(new Map([
      ["c", ["a"]],
      ["a", ["b"]],
      ["b", ["c", "c"]],
      ["z", ["z"]],
    ]))).toEqual(["a -> b -> c -> a", "z -> z"]);
  });
});
