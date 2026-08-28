import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { evaluateCapabilities, normalizeCapabilityProbe } from "./harness/capabilities.mjs";

const productRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(productRoot, "..");
const artifactRelative = "capabilities/capabilities.json";
const artifactPath = path.join(productRoot, "qa", "artifacts", "harness", artifactRelative);
const schemaPath = path.join(productRoot, "qa", "harness", "capabilities.schema.json");
const supabaseBin = path.join(productRoot, "node_modules", ".bin", "supabase");
const requireContainer = process.argv.includes("--require-container");

function probe(command, executable, args) {
  const result = spawnSync(executable, args, { cwd: productRoot, encoding: "utf8", timeout: 10_000 });
  return normalizeCapabilityProbe({
    command,
    status: result.status,
    stdout: result.stdout,
    stderr: result.error?.message || result.stderr,
  });
}

const probes = {
  node: probe("node", process.execPath, ["--version"]),
  pnpm: probe("pnpm", "pnpm", ["--version"]),
  git: probe("git", "git", ["--version"]),
  supabase: probe("supabase", supabaseBin, ["--version"]),
  docker: probe("docker", "docker", ["info", "--format", "{{.ServerVersion}}"]),
  podman: probe("podman", "podman", ["info", "--format", "{{.Version.Version}}"]),
};
const evaluation = evaluateCapabilities(probes, { requireContainer });
const receipt = {
  schemaVersion: "2.0.0",
  sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
  collectedAt: new Date().toISOString(),
  requireContainer,
  ...evaluation,
  probes,
};

const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
if (!validate(receipt)) {
  throw new Error(`Capability receipt schema failure: ${ajv.errorsText(validate.errors)}`);
}

await mkdir(path.dirname(artifactPath), { recursive: true });
await writeFile(artifactPath, `${JSON.stringify(receipt, null, 2)}\n`);
if (evaluation.status === "fail") {
  process.stderr.write(`Capability preflight FAIL: missing ${evaluation.missing.join(", ")}. Receipt: ${artifactPath}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Capability preflight PASS${evaluation.containerRuntime ? ` via ${evaluation.containerRuntime}` : " (portable lane)"}.\n`);
}
