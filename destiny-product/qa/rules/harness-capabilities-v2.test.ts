import { describe, expect, it } from "vitest";

async function capabilities() {
  const modulePath = "../../scripts/harness/" + "capabilities.mjs";
  return import(/* @vite-ignore */ modulePath);
}

const available = (command: string, version = `${command} 1.0.0`) => ({
  command,
  status: 0,
  stdout: version,
  stderr: "",
});

const unavailable = (command: string) => ({
  command,
  status: null,
  stdout: "",
  stderr: `spawn ${command} ENOENT`,
});

describe("harness environment capabilities", () => {
  it("normalizes bounded, secret-safe command probes", async () => {
    const { normalizeCapabilityProbe } = await capabilities();
    expect(normalizeCapabilityProbe(available("node", "v22.18.0\nextra"))).toEqual({
      command: "node",
      available: true,
      version: "v22.18.0 extra",
    });
    expect(normalizeCapabilityProbe(unavailable("docker"))).toEqual({
      command: "docker",
      available: false,
      error: "spawn docker ENOENT",
    });
    expect(() => normalizeCapabilityProbe({ command: "", status: 0, stdout: "", stderr: "" }))
      .toThrow("Capability probe command");
  });

  it("selects a compatible container engine and requires every core tool", async () => {
    const { evaluateCapabilities, normalizeCapabilityProbe } = await capabilities();
    const result = evaluateCapabilities({
      node: normalizeCapabilityProbe(available("node")),
      pnpm: normalizeCapabilityProbe(available("pnpm")),
      git: normalizeCapabilityProbe(available("git")),
      supabase: normalizeCapabilityProbe(available("supabase")),
      docker: normalizeCapabilityProbe(unavailable("docker")),
      podman: normalizeCapabilityProbe(available("podman")),
    }, { requireContainer: true });

    expect(result).toEqual({
      status: "pass",
      required: ["node", "pnpm", "git", "supabase", "container-engine"],
      missing: [],
      containerRuntime: "podman",
    });
  });

  it("fails closed with deterministic missing-capability guidance", async () => {
    const { evaluateCapabilities, normalizeCapabilityProbe } = await capabilities();
    const result = evaluateCapabilities({
      node: normalizeCapabilityProbe(available("node")),
      pnpm: normalizeCapabilityProbe(unavailable("pnpm")),
      git: normalizeCapabilityProbe(available("git")),
      supabase: normalizeCapabilityProbe(unavailable("supabase")),
      docker: normalizeCapabilityProbe(unavailable("docker")),
      podman: normalizeCapabilityProbe(unavailable("podman")),
    }, { requireContainer: true });

    expect(result).toEqual({
      status: "fail",
      required: ["node", "pnpm", "git", "supabase", "container-engine"],
      missing: ["pnpm", "supabase", "container-engine"],
      containerRuntime: null,
    });
  });

  it("records container availability without requiring it in the portable lane", async () => {
    const { evaluateCapabilities, normalizeCapabilityProbe } = await capabilities();
    const result = evaluateCapabilities({
      node: normalizeCapabilityProbe(available("node")),
      pnpm: normalizeCapabilityProbe(available("pnpm")),
      git: normalizeCapabilityProbe(available("git")),
      supabase: normalizeCapabilityProbe(available("supabase")),
      docker: normalizeCapabilityProbe(unavailable("docker")),
      podman: normalizeCapabilityProbe(unavailable("podman")),
    }, { requireContainer: false });

    expect(result).toEqual({
      status: "pass",
      required: ["node", "pnpm", "git", "supabase"],
      missing: [],
      containerRuntime: null,
    });
  });
});
