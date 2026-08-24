import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FULL_SHA = /^[0-9a-f]{40}$/;
const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const evidenceDirectory = path.join(productRoot, "qa", "artifacts", "staging-evidence");

export function assertExactHead({ eventSha, gitSha, stampSha }) {
  if (![eventSha, gitSha, stampSha].every((value) => FULL_SHA.test(value ?? ""))) {
    throw new Error("Staging identity mismatch: every identity must be a full SHA.");
  }
  if (eventSha !== gitSha || gitSha !== stampSha) {
    throw new Error(
      `Staging identity mismatch: event=${eventSha} git=${gitSha} stamp=${stampSha}.`,
    );
  }
}

export function assertZero5xx(results) {
  const failures = results.filter(({ status }) => status >= 500 || status < 100);
  if (failures.length) {
    const evidence = failures.map(({ route, status }) => `${route}=${status}`).join(", ");
    throw new Error(`Staging did not record zero 5xx: ${evidence}.`);
  }
}

function git(args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function runBuild(environment) {
  const pnpmCli = process.env.npm_execpath;
  const command = pnpmCli ? process.execPath : "pnpm";
  const args = pnpmCli ? [pnpmCli, "build"] : ["build"];
  const result = spawnSync(command, args, {
    cwd: productRoot,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Production build failed with status ${result.status}.`);
}

function staticRouteFromFile(file) {
  const prefix = "destiny-product/src/app/";
  if (!file.startsWith(prefix) || !/(?:page|route)\.(?:ts|tsx)$/.test(file)) return null;
  const segments = file.slice(prefix.length).split("/").slice(0, -1)
    .filter((segment) => !/^\(.+\)$/.test(segment));
  if (segments.some((segment) => segment.startsWith("[") || segment.startsWith("_"))) return null;
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

function touchedRoutes(baseSha, headSha) {
  const routes = new Set(["/", "/api/version"]);
  if (!FULL_SHA.test(baseSha ?? "")) return [...routes];
  const files = git(["diff", "--name-only", `${baseSha}...${headSha}`]).split("\n").filter(Boolean);
  for (const file of files) {
    const route = staticRouteFromFile(file);
    if (route) routes.add(route);
  }
  return [...routes].sort();
}

async function waitUntilReady(origin, runtimeLog) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(`${origin}/`, { redirect: "manual" });
      if (response.status > 0 && response.status < 500) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Staging server did not become ready.\n${runtimeLog.join("")}`);
}

async function probeRoutes(origin, routes) {
  const results = [];
  for (const route of routes) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    results.push({ route, status: response.status });
  }
  return results;
}

async function main() {
  const eventSha = process.env.DESTINY_EXPECTED_SHA?.trim() ?? "";
  const baseSha = process.env.DESTINY_BASE_SHA?.trim() ?? "";
  const gitSha = git(["rev-parse", "HEAD"]);
  const port = process.env.DESTINY_STAGING_PORT?.trim() || "4173";
  const environment = {
    ...process.env,
    DESTINY_RUNTIME_ENV: "ci-ephemeral-staging",
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "ci-ephemeral-staging-key",
  };

  if (!FULL_SHA.test(eventSha)) throw new Error("DESTINY_EXPECTED_SHA must be a full SHA.");
  if (gitSha !== eventSha) {
    throw new Error(`Staging checkout mismatch before build: event=${eventSha} git=${gitSha}.`);
  }

  await mkdir(evidenceDirectory, { recursive: true });
  runBuild(environment);
  const stamp = JSON.parse(await readFile(
    path.join(productRoot, ".generated", "build-stamp.json"),
    "utf8",
  ));
  assertExactHead({ eventSha, gitSha, stampSha: stamp.sha });

  const runtimeLog = [];
  const server = spawn(
    path.join(productRoot, "node_modules", ".bin", "next"),
    ["start", "-H", "127.0.0.1", "-p", port],
    { cwd: productRoot, env: environment, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (chunk) => runtimeLog.push(chunk.toString()));
  server.stderr.on("data", (chunk) => runtimeLog.push(chunk.toString()));

  try {
    const origin = `http://127.0.0.1:${port}`;
    await waitUntilReady(origin, runtimeLog);
    const results = await probeRoutes(origin, touchedRoutes(baseSha, gitSha));
    assertZero5xx(results);

    const version = results.find(({ route }) => route === "/api/version");
    if (version?.status === 200) {
      const liveStamp = await fetch(`${origin}/api/version`).then((response) => response.json());
      assertExactHead({ eventSha, gitSha, stampSha: liveStamp.sha });
    }

    const routeLines = results.map(({ route, status }) => `${route}=${status}`);
    const summary = [
      `head_sha=${gitSha}`,
      `tree_sha=${git(["rev-parse", "HEAD^{tree}"])}`,
      ...routeLines.map((line) => `route=${line}`),
      "zero 5xx",
    ];
    await Promise.all([
      writeFile(path.join(evidenceDirectory, "build-stamp.json"), `${JSON.stringify(stamp, null, 2)}\n`),
      writeFile(path.join(evidenceDirectory, "routes.txt"), `${routeLines.join("\n")}\n`),
      writeFile(path.join(evidenceDirectory, "runtime.log"), runtimeLog.join("")),
      writeFile(path.join(evidenceDirectory, "summary.txt"), `${summary.join("\n")}\n`),
    ]);
    process.stdout.write(`${summary.join("\n")}\n`);
  } finally {
    server.kill("SIGTERM");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
