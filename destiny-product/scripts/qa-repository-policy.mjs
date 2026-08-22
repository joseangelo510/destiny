import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasNonLatinLetters } from "./eslint/rules/english-only.mjs";

const productRoot = path.resolve(import.meta.dirname, "..");
const baselinePath = path.join(productRoot, "file-length-baseline.json");
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignoredDirectories = new Set([".git", ".next", "node_modules", "out", "build", "coverage", "vendor"]);

function normalized(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function isDataOnlyFixture(value) {
  return /(^|\/)fixtures?\//.test(value) && /\.(?:json|snap)$/i.test(value)
    || /(^|\/)snapshots?\//.test(value) && /\.(?:json|snap)$/i.test(value);
}

export function classifySourceFile(relativePath) {
  const file = normalized(relativePath);
  const basename = path.posix.basename(file);
  if (
    file.startsWith("vendor/")
    || file.startsWith("supabase/migrations/")
    || /database\.types\.[cm]?[jt]s$/i.test(file)
    || /\.(?:css|scss|sass|less)$/i.test(file)
    || /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/i.test(file)
    || isDataOnlyFixture(file)
  ) return null;
  if (!codeExtensions.has(path.posix.extname(basename))) return null;
  return /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(file) ? "test" : "production";
}

export function evaluateFileLengths({ files, baseline }) {
  const productionMax = Number(baseline.productionMax ?? 500);
  const testMax = Number(baseline.testMax ?? 800);
  const previous = baseline.files && typeof baseline.files === "object" ? baseline.files : {};
  const nextFiles = {};
  const errors = [];

  for (const file of files) {
    const kind = classifySourceFile(file.path);
    if (!kind) continue;
    const cap = kind === "test" ? testMax : productionMax;
    const oldLimit = Number(previous[file.path] ?? 0);
    if (file.lines <= cap) continue;
    if (!oldLimit) errors.push(`${file.path} has ${file.lines} lines; new ${kind} files may not exceed ${cap}.`);
    else if (file.lines > oldLimit) errors.push(`${file.path} grew from its ${oldLimit}-line baseline to ${file.lines}.`);
    nextFiles[file.path] = oldLimit ? Math.min(oldLimit, file.lines) : file.lines;
  }

  return {
    errors,
    nextBaseline: {
      policyVersion: Number(baseline.policyVersion ?? 1),
      productionMax,
      testMax,
      files: Object.fromEntries(Object.entries(nextFiles).sort(([a], [b]) => a.localeCompare(b))),
    },
  };
}

async function filesBelow(directory, relative = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const childRelative = relative ? path.join(relative, entry.name) : entry.name;
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(child, childRelative));
    else if (entry.isFile() && classifySourceFile(childRelative)) {
      const contents = await readFile(child, "utf8");
      files.push({ path: normalized(childRelative), lines: contents.split("\n").length });
    }
  }
  return files;
}

async function main() {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const result = evaluateFileLengths({ files: await filesBelow(productRoot), baseline });
  if (result.errors.length) {
    process.stderr.write(`${result.errors.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  const serialized = `${JSON.stringify(result.nextBaseline, null, 2)}\n`;
  if (serialized !== await readFile(baselinePath, "utf8")) {
    await writeFile(baselinePath, serialized);
    process.stdout.write("File-length baseline tightened. Commit file-length-baseline.json.\n");
  }
}

export { hasNonLatinLetters };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
