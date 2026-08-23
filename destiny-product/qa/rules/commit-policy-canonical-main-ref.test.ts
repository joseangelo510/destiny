import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  commitsRequiringShapeValidation,
  resolveProtectedMainRef,
} from "../../scripts/qa-commit-policy.mjs";

const temporaryRepositories: string[] = [];

function git(repository: string, args: string[]) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
}

async function createRepository() {
  const repository = await mkdtemp(path.join(os.tmpdir(), "destiny-commit-policy-"));
  temporaryRepositories.push(repository);
  git(repository, ["init", "--quiet"]);
  git(repository, ["config", "user.name", "Destiny Test"]);
  git(repository, ["config", "user.email", "destiny@example.com"]);
  await writeFile(path.join(repository, "README.md"), "protected main fixture\n");
  git(repository, ["add", "README.md"]);
  git(repository, ["commit", "--quiet", "-m", "fixture"]);
  return { repository, sha: git(repository, ["rev-parse", "HEAD"]) };
}

function addRemote(repository: string, name: "origin" | "github", url: string, sha?: string) {
  git(repository, ["remote", "add", name, url]);
  if (sha) git(repository, ["update-ref", `refs/remotes/${name}/main`, sha]);
}

afterEach(async () => {
  await Promise.all(temporaryRepositories.splice(0).map((repository) => rm(repository, { recursive: true, force: true })));
});

describe("canonical protected main ref resolution", () => {
  it("selects canonical origin/main in the GitHub Actions layout", async () => {
    const { repository, sha } = await createRepository();
    addRemote(repository, "origin", "https://github.com/joseangelo510/destiny.git", sha);

    expect(resolveProtectedMainRef(repository)).toBe("refs/remotes/origin/main");
  });

  it("selects canonical github/main when origin is a local mirror", async () => {
    const { repository, sha } = await createRepository();
    addRemote(repository, "origin", "/tmp/destiny-ranking-digest");
    addRemote(repository, "github", "git@github.com:joseangelo510/destiny.git", sha);

    expect(resolveProtectedMainRef(repository)).toBe("refs/remotes/github/main");
  });

  it("does not exempt a commit reachable only from a spoofed origin", async () => {
    const { repository, sha: canonicalSha } = await createRepository();
    addRemote(repository, "github", "git@github.com:joseangelo510/destiny.git", canonicalSha);
    await writeFile(path.join(repository, "mirror-only.txt"), "unprotected\n");
    git(repository, ["add", "mirror-only.txt"]);
    git(repository, ["commit", "--quiet", "-m", "mirror only"]);
    const mirrorOnlySha = git(repository, ["rev-parse", "HEAD"]);
    addRemote(repository, "origin", "/tmp/unprotected-mirror", mirrorOnlySha);

    const protectedRef = resolveProtectedMainRef(repository);
    const protectedShas = new Set(git(repository, ["rev-list", protectedRef]).split("\n"));
    const mirrorCommit = { sha: mirrorOnlySha, subject: "unprefixed mirror commit" };
    expect(protectedRef).toBe("refs/remotes/github/main");
    expect(commitsRequiringShapeValidation({
      commits: [mirrorCommit],
      protectedMainReachableShas: protectedShas,
    })).toEqual([mirrorCommit]);
  });

  it("fails closed with diagnostics when neither candidate is canonical", async () => {
    const { repository, sha } = await createRepository();
    addRemote(repository, "origin", "/tmp/local-origin", sha);
    addRemote(repository, "github", "https://example.com/joseangelo510/destiny.git", sha);

    expect(() => resolveProtectedMainRef(repository)).toThrow(/origin.*local-origin.*non-canonical.*github.*example\.com.*non-canonical/is);
  });

  it("fails closed when a canonical remote has no remote-tracking main ref", async () => {
    const { repository } = await createRepository();
    addRemote(repository, "origin", "/tmp/local-origin");
    addRemote(repository, "github", "git@github.com:joseangelo510/destiny.git");

    expect(() => resolveProtectedMainRef(repository)).toThrow(/github.*remote-tracking main ref is missing/is);
  });

  it("accepts only the enumerated canonical URL normalization matrix", async () => {
    const canonicalBases = [
      "https://github.com/joseangelo510/destiny",
      "git@github.com:joseangelo510/destiny",
      "ssh://git@github.com/joseangelo510/destiny",
    ];
    for (const base of canonicalBases) {
      for (const suffix of ["", ".git", "/", ".git/"]) {
        const { repository, sha } = await createRepository();
        addRemote(repository, "github", `${base}${suffix}`, sha);
        expect(resolveProtectedMainRef(repository), `${base}${suffix}`).toBe("refs/remotes/github/main");
      }
    }
  });

  it("rejects near-miss repository identities", async () => {
    for (const url of [
      "https://github.com/other/destiny.git",
      "https://github.com/joseangelo510/destiny-fork.git",
      "https://gitlab.com/joseangelo510/destiny.git",
      "https://github.com/prefix/joseangelo510/destiny.git",
      "https://github.com/joseangelo510/destiny/extra.git",
    ]) {
      const { repository, sha } = await createRepository();
      addRemote(repository, "github", url, sha);
      expect(() => resolveProtectedMainRef(repository), url).toThrow(/non-canonical/i);
    }
  });

  it("rejects a local branch spoof named github/main", async () => {
    const { repository } = await createRepository();
    addRemote(repository, "github", "git@github.com:joseangelo510/destiny.git");
    git(repository, ["branch", "github/main"]);

    expect(() => resolveProtectedMainRef(repository)).toThrow(/remote-tracking main ref is missing/i);
  });

  it("resolves entirely offline from a fabricated remote-tracking ref", async () => {
    const { repository, sha } = await createRepository();
    addRemote(repository, "github", "ssh://git@github.com/joseangelo510/destiny.git", sha);

    expect(resolveProtectedMainRef(repository)).toBe("refs/remotes/github/main");
  });
});
