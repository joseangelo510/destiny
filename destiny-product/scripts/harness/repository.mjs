import { execFileSync, spawnSync } from "node:child_process";

export function git(repositoryRoot, args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

export function resolveProtectedMainRef({ override, refExists, purpose = "Harness" }) {
  if (override) return override;
  for (const candidate of ["origin/main", "github/main"]) if (refExists(candidate)) return candidate;
  throw new Error(`${purpose} requires a canonical protected-main ref.`);
}

export function protectedMainRef({ repositoryRoot, override, purpose }) {
  return resolveProtectedMainRef({
    override,
    purpose,
    refExists: (candidate) => spawnSync("git", ["rev-parse", "--verify", "--quiet", candidate], { cwd: repositoryRoot }).status === 0,
  });
}
