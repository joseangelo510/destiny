import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const FULL_SHA = /^[0-9a-f]{40}$/;
const CANONICAL_REMOTES = new Set([
  "https://github.com/joseangelo510/destiny",
  "git@github.com:joseangelo510/destiny",
  "ssh://git@github.com/joseangelo510/destiny",
]);

function argumentsMap(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error(`Invalid argument near ${key ?? "<end>"}.`);
    parsed.set(key.slice(2), value);
  }
  return parsed;
}

function git(args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

function normalizedRemoteUrl(value) {
  let normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  if (normalized.endsWith(".git")) normalized = normalized.slice(0, -4);
  return normalized;
}

function expectedFromRemote(remoteName) {
  const remoteUrl = git(["config", "--get", `remote.${remoteName}.url`]);
  if (!CANONICAL_REMOTES.has(normalizedRemoteUrl(remoteUrl))) {
    throw new Error(`Remote ${remoteName} is not the canonical Destiny repository.`);
  }
  const line = git(["ls-remote", remoteName, "refs/heads/main"]);
  const sha = line.split(/\s+/)[0];
  if (!FULL_SHA.test(sha)) throw new Error("Canonical main did not resolve to a full Git SHA.");
  return sha;
}

function treeForCommit(sha) {
  const tree = git(["rev-parse", `${sha}^{tree}`]);
  if (!FULL_SHA.test(tree)) throw new Error("Canonical main tree could not be resolved locally.");
  return tree;
}

async function versionPayload(options) {
  if (options.get("fixture")) {
    return JSON.parse(await readFile(path.resolve(productRoot, options.get("fixture")), "utf8"));
  }
  const base = options.get("url") ?? process.env.DESTINY_LIVE_URL;
  if (!base) throw new Error("Provide --url or DESTINY_LIVE_URL for the live Destiny instance.");
  const endpoint = new URL("/api/version", base);
  const response = await fetch(endpoint, {
    headers: { "User-Agent": "Destiny-P1-Preflight/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Version endpoint returned HTTP ${response.status}.`);
  return response.json();
}

function assertValidPayload(payload, expectedSha, expectedTree) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Version payload is not an object.");
  for (const field of ["sha", "tree", "builtAt", "env"]) {
    if (payload[field] === "unknown") throw new Error(`Build provenance field ${field} is unknown.`);
  }
  if (!FULL_SHA.test(payload.sha)) throw new Error("Build provenance SHA is invalid.");
  if (!FULL_SHA.test(payload.tree)) throw new Error("Build provenance tree is invalid.");
  if (Number.isNaN(Date.parse(payload.builtAt))) throw new Error("Build provenance timestamp is invalid.");
  if (typeof payload.env !== "string" || !payload.env.trim()) throw new Error("Build provenance environment is invalid.");
  if (payload.sha !== expectedSha) throw new Error(`Live SHA ${payload.sha} does not match canonical main ${expectedSha}.`);
  if (payload.tree !== expectedTree) throw new Error(`Live tree ${payload.tree} does not match canonical tree ${expectedTree}.`);
}

try {
  const options = argumentsMap(process.argv.slice(2));
  const remote = options.get("remote") ?? "origin";
  const expectedSha = options.get("expected-sha") ?? expectedFromRemote(remote);
  if (!FULL_SHA.test(expectedSha)) throw new Error("Expected SHA must be a full 40-character Git SHA.");
  const expectedTree = options.get("expected-tree") ?? treeForCommit(expectedSha);
  if (!FULL_SHA.test(expectedTree)) throw new Error("Expected tree must be a full 40-character Git SHA.");
  const payload = await versionPayload(options);
  assertValidPayload(payload, expectedSha, expectedTree);
  process.stdout.write(`P1 PASS sha=${payload.sha} tree=${payload.tree} env=${payload.env} builtAt=${payload.builtAt}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`P1 FAIL: ${message}\n`);
  process.exitCode = 1;
}

