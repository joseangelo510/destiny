import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateChecklist } from "./governance-policy.mjs";

export function validatePreflight({ body, headSha, inventoryDirty }) {
  return [
    ...(inventoryDirty ? ["Generated QA inventory differs from the committed inventory."] : []),
    ...(!/^[0-9a-f]{40}$/.test(headSha ?? "") ? ["A full 40-character head SHA is required."] : []),
    ...(body === undefined ? [] : evaluateChecklist(body, { headSha }).errors),
  ];
}

async function main() {
  const root = path.resolve(import.meta.dirname, "../..");
  const args = process.argv.slice(2);
  if (args.length && (args[0] !== "--body-file" || !args[1] || args.length !== 2)) throw new Error("Usage: pnpm qa:pr-preflight [--body-file /absolute/path/to/pr.md]");
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  execFileSync(process.execPath, [path.join(root, "destiny-product/scripts/qa-inventory.mjs")], { cwd: path.join(root, "destiny-product"), stdio: "inherit" });
  const inventoryDirty = Boolean(execFileSync("git", ["status", "--porcelain", "--", "destiny-product/qa/inventory"], { cwd: root, encoding: "utf8" }).trim());
  const body = args[1] ? await readFile(path.resolve(args[1]), "utf8") : undefined;
  const errors = validatePreflight({ body, headSha, inventoryDirty });
  if (errors.length) { process.stderr.write(`${errors.join("\n")}\n`); process.exitCode = 1; }
  else process.stdout.write(body === undefined ? "Inventory preflight passed. Supply --body-file before submitting final PR evidence.\n" : "Inventory and PR evidence format passed. GitHub must still verify runs, approval and current head.\n");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
