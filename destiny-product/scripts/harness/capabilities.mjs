const CORE_CAPABILITIES = ["node", "pnpm", "git", "supabase"];

function bounded(value) {
  return String(value ?? "")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(token|password|secret|api[_-]?key)\s*[=:]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function normalizeCapabilityProbe(probe) {
  if (!probe || typeof probe.command !== "string" || !probe.command.trim()) {
    throw new Error("Capability probe command must be a non-empty string.");
  }
  const command = probe.command.trim();
  if (probe.status === 0) {
    const version = bounded(probe.stdout || probe.stderr);
    return { command, available: true, ...(version ? { version } : {}) };
  }
  const detail = bounded(probe.stderr || probe.stdout || `exit status ${probe.status ?? "unavailable"}`);
  return { command, available: false, error: detail };
}

export function evaluateCapabilities(probes, { requireContainer }) {
  const required = [...CORE_CAPABILITIES, ...(requireContainer ? ["container-engine"] : [])];
  const missing = CORE_CAPABILITIES.filter((name) => !probes[name]?.available);
  const containerRuntime = probes.docker?.available
    ? "docker"
    : probes.podman?.available
      ? "podman"
      : null;
  if (requireContainer && !containerRuntime) missing.push("container-engine");
  return {
    status: missing.length ? "fail" : "pass",
    required,
    missing,
    containerRuntime,
  };
}
