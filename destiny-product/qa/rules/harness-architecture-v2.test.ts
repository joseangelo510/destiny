import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

  it("parses compact valid modules without treating comments or strings as imports", async () => {
    const { parseModuleSpecifiers } = await loadArchitectureModule();
    expect(parseModuleSpecifiers(`
      export*from "./star";
      import{compact}from"./compact";
      export{named}from"./named";
      import type{Contract}from"./contract";
      import legacyAlias=require("./import-equals");
      const lazy=import("./lazy");
      const legacy=require("./legacy");
      const variable="./variable-decoy";
      other("./call-decoy");
      require(variable);
      require();
      require(42);
      const decoy='import fake from "./string-decoy"';
      // export { fake } from "./comment-decoy";
    `)).toEqual(["./star", "./compact", "./named", "./contract", "./import-equals", "./lazy", "./legacy"]);
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

  it("normalizes operating-system paths and anchors every delivery boundary", async () => {
    const { evaluateArchitectureImports } = await loadArchitectureModule();
    expect(evaluateArchitectureImports([
      { file: "src\\lib\\seo\\policy.ts", specifier: "@/app/page", resolved: "src/app/page" },
    ])).toEqual(["src/lib/seo/policy.ts may not import delivery module @/app/page."]);
    expect(evaluateArchitectureImports([
      { file: "src/lib/seo/policy.ts", specifier: "./app/page", resolved: "./app/page" },
      { file: "prefix/src/app/api/a/route.ts", specifier: "@/app/api/b/route", resolved: "src/app/api/b/route" },
      { file: "src/app/api/a/route.ts.extra", specifier: "@/app/api/b/route", resolved: "src/app/api/b/route" },
      { file: "src/app/api/a/route.ts", specifier: "@/app/api/b/route-extra", resolved: "src/app/api/b/route-extra" },
      { file: "supabase/functions/a/index.ts", specifier: "./domain/value", resolved: "./domain/value" },
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

  it("keeps reoptimization domain contracts acyclic", async () => {
    const { detectDependencyCycles, parseModuleSpecifiers, resolveLocalSpecifier } = await loadArchitectureModule();
    const files = [
      "src/lib/seo/reoptimization-document.ts",
      "src/lib/seo/reoptimization-strategy.ts",
      "src/lib/seo/reoptimization-types.ts",
    ];
    const present = new Set(files);
    const graph = new Map<string, string[]>();
    for (const file of files) {
      const source = await readFile(path.join(process.cwd(), file), "utf8").catch(() => "");
      graph.set(file, parseModuleSpecifiers(source)
        .map((specifier: string) => resolveLocalSpecifier(file, specifier))
        .map((candidate: string | null) => candidate && !candidate.endsWith(".ts") ? `${candidate}.ts` : candidate)
        .filter((candidate: string | null): candidate is string => Boolean(candidate && present.has(candidate))));
    }
    expect(detectDependencyCycles(graph)).toEqual([]);
  });
});
