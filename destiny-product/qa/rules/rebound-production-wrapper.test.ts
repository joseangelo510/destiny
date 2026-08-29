import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(process.cwd(), "..");
const releaseSha = "fbd738c6508c9cde75231dea60acebe842eb0b6f";
const releaseTag = "rebound-seo-v1.0.0";
const priorImageDigest = "sha256:e30c56dd27c8e3e7c28217cacb6eb82c3f08a2c81eedaa7d0e8da17b374af5bd";
const priorMachineId = "860714be531938";

async function repositoryFile(relativePath: string) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
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
