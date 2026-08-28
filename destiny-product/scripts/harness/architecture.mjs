import path from "node:path";
import ts from "typescript";

export function parseModuleSpecifiers(source) {
  const sourceFile = ts.createSourceFile("architecture-input.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers = [];
  const collect = (candidate) => {
    if (candidate && ts.isStringLiteralLike(candidate)) specifiers.push(candidate.text);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) collect(node.moduleSpecifier);
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      collect(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const commonJsRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (dynamicImport || commonJsRequire) collect(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

function destination(specifier) {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  return specifier.replace(/^\.\//, "");
}

export function evaluateArchitectureImports(imports) {
  const errors = [];
  for (const dependency of imports) {
    const file = dependency.file.replaceAll("\\", "/");
    const target = destination(dependency.resolved ?? dependency.specifier);
    if (file.startsWith("src/lib/") && (target.startsWith("src/app/") || target.startsWith("src/components/"))) {
      errors.push(`${file} may not import delivery module ${dependency.specifier}.`);
    }
    if (file.startsWith("src/components/") && target.startsWith("src/app/")) {
      errors.push(`${file} may not import route module ${dependency.specifier}.`);
    }
    if (file.startsWith("supabase/functions/") && (target.startsWith("src/app/") || target.startsWith("src/components/"))) {
      errors.push(`${file} may not import web delivery module ${dependency.specifier}.`);
    }
    if (/^src\/app\/.+\/route\.[cm]?[jt]s$/.test(file) && /src\/app\/.+\/route(?:\.[cm]?[jt]s)?$/.test(target)) {
      errors.push(`${file} may not import another route implementation ${dependency.specifier}.`);
    }
  }
  return errors;
}

export function resolveLocalSpecifier(file, specifier) {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (!specifier.startsWith(".")) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
}

export function detectDependencyCycles(graph) {
  const cycles = new Set();
  const visited = new Set();
  const active = [];

  function visit(node) {
    const index = active.indexOf(node);
    if (index >= 0) {
      const cycle = [...active.slice(index), node];
      const body = cycle.slice(0, -1);
      const rotations = body.map((_, position) => [...body.slice(position), ...body.slice(0, position)]);
      const canonical = rotations.map((rotation) => `${rotation.join(" -> ")} -> ${rotation[0]}`).sort()[0];
      cycles.add(canonical);
      return;
    }
    if (visited.has(node)) return;
    active.push(node);
    for (const dependency of [...(graph.get(node) ?? [])].sort()) visit(dependency);
    active.pop();
    visited.add(node);
  }

  for (const node of [...graph.keys()].sort()) visit(node);
  return [...cycles].sort();
}
