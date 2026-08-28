import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const supabaseBin = path.join(productRoot, "node_modules", ".bin", "supabase");
const browserEnvironmentFile = path.join(tmpdir(), `destiny-browser-${randomUUID()}.env`);
const temporaryArtifacts = new Set([browserEnvironmentFile]);
let supabaseAttempted = false;

function printable(command, args) {
  return [command, ...args].join(" ");
}

function run(command, args, { allowFailure = false, cwd = productRoot, env = process.env } = {}) {
  process.stdout.write(`\n[harness] ${printable(command, args)}\n`);
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error && !allowFailure) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`Harness command failed (${result.status ?? "no status"}): ${printable(command, args)}`);
  }
  return result.status === 0;
}

function runPnpm(args, options = {}) {
  const pnpmCli = process.env.npm_execpath;
  return pnpmCli
    ? run(process.execPath, [pnpmCli, ...args], options)
    : run("pnpm", args, options);
}

async function readEnvironment(file) {
  const entries = {};
  for (const line of (await readFile(file, "utf8")).split("\n")) {
    if (!line.trim()) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error(`Invalid browser environment line: ${line}`);
    entries[line.slice(0, separator)] = line.slice(separator + 1);
  }
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "QA_AUTH_STATE",
    "QA_LOCAL_BROWSER_FIXTURE",
  ]) {
    if (!entries[key]) throw new Error(`Browser fixture did not provide ${key}.`);
  }
  temporaryArtifacts.add(entries.QA_AUTH_STATE);
  temporaryArtifacts.add(entries.QA_LOCAL_BROWSER_FIXTURE);
  return entries;
}

try {
  runPnpm(["qa:capabilities:required"]);
  runPnpm(["qa:repository"]);
  run("git", ["diff", "--exit-code", "--", "destiny-product/file-length-baseline.json"], { cwd: repositoryRoot });
  runPnpm(["qa:commits"]);
  runPnpm(["qa:deploy-log"]);
  runPnpm(["qa:inventory"]);
  run("git", ["diff", "--exit-code", "--", "destiny-product/qa/inventory"], { cwd: repositoryRoot });
  runPnpm(["qa:migrations"]);
  runPnpm(["qa:audit"]);
  runPnpm(["qa:harness-v2"]);
  runPnpm(["lint"]);
  runPnpm(["test"]);

  supabaseAttempted = true;
  run(supabaseBin, [
    "start",
    "-x",
    "realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor",
  ]);
  runPnpm(["qa:isolation"]);
  runPnpm(["qa:browser-fixture"], {
    env: { ...process.env, QA_BROWSER_ENV_FILE: browserEnvironmentFile },
  });

  const browserEnvironment = await readEnvironment(browserEnvironmentFile);
  const environment = { ...process.env, ...browserEnvironment };
  runPnpm(["build"], { env: environment });
  runPnpm([
    "exec",
    "playwright",
    "install",
    ...(process.env.CI ? ["--with-deps"] : []),
    "chromium",
  ], { env: environment });
  runPnpm(["test:e2e"], { env: environment });
} finally {
  if (supabaseAttempted) run(supabaseBin, ["stop", "--no-backup"], { allowFailure: true });
  await Promise.all([...temporaryArtifacts].map((file) => rm(file, { force: true })));
}
