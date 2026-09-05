import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(process.cwd(), "..");
const releaseSha = "dffe81bfe0ff326988ada580c1316399d2ffc69c";
const releaseTag = "rebound-seo-v1.1.3";
const productionImageTag = "rebound-seo-v1.1.3-prod";
const priorReleaseSha = "4f42e08f404b34700ea8b1d0d216b2624654150c";
const priorReleaseTag = "rebound-seo-v1.1.2";
const priorImageDigest = "sha256:6fe1106aadb5fbe2367581302b106f27f508378af213171ea2c44077aa23261a";
const priorMachineId = "860714be531938";
const authorizedImplementationFiles = [
  ".github/workflows/rebound-production-deploy.yml",
  "Dockerfile",
  "destiny-product/qa/rules/rebound-production-wrapper.test.ts",
];
const routePlaceholder = "00000000-0000-0000-0000-000000000000";
const genericRouteMaterializer = String.raw`gsub("\\[[^/\\[\\]]+\\]"; $route_placeholder)`;

async function repositoryFile(relativePath: string) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function materializeRoutes(routes: string[]) {
  const result = execFileSync("jq", [
    "-nr",
    "--argjson",
    "routes",
    JSON.stringify(routes),
    "--arg",
    "route_placeholder",
    routePlaceholder,
    `$routes[] | ${genericRouteMaterializer}`,
  ], { encoding: "utf8" });
  return result.trimEnd().split("\n");
}

async function registryPreflight(mode: string) {
  const workflow = await repositoryFile(".github/workflows/rebound-production-deploy.yml");
  const marker = "      - name: Refuse existing or unverifiable release image tags\n        run: |\n";
  expect(workflow).toContain(marker);
  const block = workflow.split(marker)[1].split("\n      - name:")[0];
  const script = block.split("\n").map((line) => line.startsWith("          ") ? line.slice(10) : line).join("\n");
  const fixtureDirectory = await mkdtemp(path.join(tmpdir(), "rebound-registry-test-"));
  try {
    const docker = path.join(fixtureDirectory, "docker");
    await writeFile(docker, [
      "#!/bin/sh",
      'printf "%s\\n" "$4" >> "$QA_CALLS"',
      'if [ "$4" = "ghcr.io/joseangelo510/destiny-production:$PRIOR_RELEASE_SHA" ]; then',
      '  if [ "$QA_MODE" = "prior-denied" ]; then echo "unauthorized" >&2; exit 1; fi',
      "  exit 0",
      "fi",
      'case "$QA_MODE" in',
      '  existing-release) [ "$4" != "ghcr.io/joseangelo510/destiny-production:$PRODUCTION_IMAGE_TAG" ] || exit 0 ;;',
      '  existing-sha) [ "$4" != "ghcr.io/joseangelo510/destiny-production:$RELEASE_SHA" ] || exit 0 ;;',
      '  denied) echo "403 forbidden" >&2; exit 1 ;;',
      '  ambiguous) echo "connection timed out" >&2; exit 1 ;;',
      '  misleading) echo "denied: not found" >&2; exit 1 ;;',
      '  absent-reference-digits) echo "ERROR: ghcr.io/example:imageabc401def403abc: not found" >&2; exit 1 ;;',
      "esac",
      'echo "ERROR: manifest unknown: not found" >&2',
      "exit 1",
    ].join("\n"));
    await chmod(docker, 0o755);
    const callsFile = path.join(fixtureDirectory, "calls.txt");
    const result = spawnSync("bash", ["-c", script], {
      cwd: fixtureDirectory,
      encoding: "utf8",
      env: { ...process.env, PATH: fixtureDirectory + path.delimiter + process.env.PATH, QA_MODE: mode, QA_CALLS: callsFile, RELEASE_SHA: releaseSha, PRIOR_RELEASE_SHA: priorReleaseSha, PRODUCTION_IMAGE_TAG: productionImageTag },
    });
    const calls = (await readFile(callsFile, "utf8")).trim().split("\n");
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls };
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
}

describe("D10.14 Rebound SEO production wrapper", () => {
  it("verifies registry access and both unused tags before publication or Fly mutation", async () => {
    const workflow = await repositoryFile(".github/workflows/rebound-production-deploy.yml");
    const guard = workflow.indexOf("- name: Refuse existing or unverifiable release image tags");
    expect(guard).toBeGreaterThan(workflow.indexOf("- name: Login GHCR"));
    expect(guard).toBeLessThan(workflow.indexOf("- name: Build and push exact Rebound image"));
    expect(workflow).toContain("            registry-preflight.txt");
    const result = await registryPreflight("absent");
    expect(result.status).toBe(0);
    expect(result.calls).toEqual([priorReleaseSha, productionImageTag, releaseSha].map((tag) => "ghcr.io/joseangelo510/destiny-production:" + tag));
    expect(result.stdout).toContain(productionImageTag + ": absent");
    expect(result.stdout).toContain(releaseSha + ": absent");
    expect((await registryPreflight("absent-reference-digits")).status).toBe(0);
  });

  it("fails closed on existing tags, denied prior access, permission errors, and ambiguous errors", async () => {
    for (const [mode, expectedCalls] of [["existing-release", 2], ["existing-sha", 3], ["prior-denied", 1], ["denied", 2], ["ambiguous", 2], ["misleading", 2]] as const) {
      const result = await registryPreflight(mode);
      expect(result.status, mode).not.toBe(0);
      expect(result.calls, mode).toHaveLength(expectedCalls);
    }
  });

  it("is manual-only, immutable, production-scoped, and rollback-capable", async () => {
    const workflow = await repositoryFile(".github/workflows/rebound-production-deploy.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain(`default: ${releaseTag}`);
    expect(workflow).not.toMatch(/^  push:/m);
    expect(workflow).toContain(`RELEASE_SHA: ${releaseSha}`);
    expect(workflow).toContain(`RELEASE_TAG: ${releaseTag}`);
    expect(workflow).toContain(`PRODUCTION_IMAGE_TAG: ${productionImageTag}`);
    expect(workflow).toContain("PRODUCTION_SITE_URL: https://app.reboundseo.com");
    expect(workflow).toContain("FLY_APP: destiny-production");
    expect(workflow).toContain(`PRIOR_IMAGE_DIGEST: ${priorImageDigest}`);
    expect(workflow).toContain(`PRIOR_MACHINE_ID: ${priorMachineId}`);
    expect(workflow).toContain(`PRIOR_RELEASE_SHA: ${priorReleaseSha}`);
    expect(workflow).toContain(`PRIOR_RELEASE_TAG: ${priorReleaseTag}`);
    expect(workflow).toContain("rollback:");
    expect(workflow).toContain("registry.fly.io/${FLY_APP}@${PRIOR_IMAGE_DIGEST}");
    expect(workflow).toContain("environment: production");
  });

  it("uses existing production configuration by key name and sweeps the complete dynamic inventory", async () => {
    const workflow = await repositoryFile(".github/workflows/rebound-production-deploy.yml");

    for (const key of [
      "FLY_API_TOKEN",
      "ANTHROPIC_API_KEY",
      "DATAFORSEO_LOGIN",
      "DATAFORSEO_PASSWORD",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "OPENAI_API_KEY",
      "SESSION_SECRET",
    ]) expect(workflow).toContain(key);

    expect(workflow).toContain("routes.json");
    expect(workflow).toContain("inventory_count=");
    expect(workflow).toContain("route_count=");
    expect(workflow).toContain('test "${route_count}" = "${inventory_count}"');
    expect(workflow).toContain("sweep_count=");
    expect(workflow).toContain('test "${sweep_count}" = "${inventory_count}"');
    expect(workflow).not.toContain("sort -u");
    expect(workflow).toContain('test "${code}" -lt 500');
    expect(workflow).not.toContain('= "79"');
  });

  it("materializes every bracketed path segment without changing ordinary routes", async () => {
    const workflow = await repositoryFile(".github/workflows/rebound-production-deploy.yml");
    const routes = [
      "/api/audits/[id]",
      "/app/content/[draftId]",
      "/synthetic/[anything]",
      "/a/[x]/b/[y]",
      "/plain/path?mode=exact",
    ];

    expect(materializeRoutes(routes)).toEqual([
      `/api/audits/${routePlaceholder}`,
      `/app/content/${routePlaceholder}`,
      `/synthetic/${routePlaceholder}`,
      `/a/${routePlaceholder}/b/${routePlaceholder}`,
      "/plain/path?mode=exact",
    ]);
    expect(workflow).toContain(genericRouteMaterializer);
    expect(workflow).not.toContain("sed 's/\\[id\\]/");
    expect(workflow).toContain("unmaterialized route placeholder");
    expect(workflow).toContain("offending_route");
    expect(workflow).toContain('test "${route_count}" = "${inventory_count}"');
  });

  it("polls rollback to simultaneous machine and live identity before final proof", async () => {
    const workflow = await repositoryFile(".github/workflows/rebound-production-deploy.yml");

    for (const required of [
      "rollback_ready=0",
      "rollback_last_observation=",
      "for attempt in $(seq 1 60); do",
      "rollback_started_count=",
      "rollback_machine_id=",
      "rollback_machine_digest=",
      "rollback_sha=",
      "rollback_tag=",
      "sleep 5",
      "Rollback verification exhausted",
      "rollback-root-status.txt",
      "rollback-build-sha.txt",
      "rollback-build-tag.txt",
      "rollback-build-env.txt",
      "rollback-build-site-url.txt",
      "rollback-progress-report-status.txt",
      "rollback-no-email.txt",
    ]) expect(workflow).toContain(required);

    expect(workflow).toContain('test "${rollback_root_code}" = "200"');
    expect(workflow).toContain('test "${rollback_report_code}" = "401"');
  });

  it("pins build identity and the one-machine Fly topology", async () => {
    const dockerfile = await repositoryFile("Dockerfile");
    const flyConfig = await repositoryFile("fly.toml");

    expect(dockerfile.split(releaseSha)).toHaveLength(3);
    expect(dockerfile.split(releaseTag)).toHaveLength(3);
    expect(dockerfile).not.toContain(priorReleaseSha);
    expect(dockerfile).not.toContain(priorReleaseTag);
    expect(dockerfile).toContain("https://app.reboundseo.com");
    expect(dockerfile).toContain("build-sha.txt");
    expect(dockerfile).toContain("build-tag.txt");
    expect(dockerfile).toContain("build-site-url.txt");

    expect(flyConfig).toContain('app = "destiny-production"');
    expect(flyConfig).toContain('primary_region = "sjc"');
    expect(flyConfig).toContain('min_machines_running = 1');
    expect(flyConfig).toContain('path = "/_next/static/build-sha.txt"');
  });

  it("records the closed D10.6 implementation scope", async () => {
    const deployLog = await repositoryFile("destiny-product/DEPLOY_LOG.md");

    expect(deployLog).toContain("### D10.6: Production release of D10.5 remediation as rebound-seo-v1.1.2");
    expect(deployLog).toContain("Exactly three files, no more and no fewer:");
    for (const file of authorizedImplementationFiles) expect(deployLog).toContain(`\`${file}\``);
    expect(authorizedImplementationFiles).toHaveLength(3);
  });
});
