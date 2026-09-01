import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(process.cwd(), "..");
const releaseSha = "d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213";
const releaseTag = "rebound-seo-v1.1.0";
const priorImageDigest = "sha256:321828758e811bbc7bd25aea52a38e253e49b5d7d1402eb27553bc1ed93bb82b";
const priorMachineId = "860714be531938";
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

describe("D9.1 Rebound SEO production wrapper", () => {
  it("is manual-only, immutable, production-scoped, and rollback-capable", async () => {
    const workflow = await repositoryFile(".github/workflows/rebound-production-deploy.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^  push:/m);
    expect(workflow).toContain(`RELEASE_SHA: ${releaseSha}`);
    expect(workflow).toContain(`RELEASE_TAG: ${releaseTag}`);
    expect(workflow).toContain("PRODUCTION_SITE_URL: https://app.reboundseo.com");
    expect(workflow).toContain("FLY_APP: destiny-production");
    expect(workflow).toContain(`PRIOR_IMAGE_DIGEST: ${priorImageDigest}`);
    expect(workflow).toContain(`PRIOR_MACHINE_ID: ${priorMachineId}`);
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

    expect(dockerfile).toContain(releaseSha);
    expect(dockerfile).toContain(releaseTag);
    expect(dockerfile).toContain("https://app.reboundseo.com");
    expect(dockerfile).toContain("build-sha.txt");
    expect(dockerfile).toContain("build-tag.txt");
    expect(dockerfile).toContain("build-site-url.txt");

    expect(flyConfig).toContain('app = "destiny-production"');
    expect(flyConfig).toContain('primary_region = "sjc"');
    expect(flyConfig).toContain('min_machines_running = 1');
    expect(flyConfig).toContain('path = "/_next/static/build-sha.txt"');
  });
});
