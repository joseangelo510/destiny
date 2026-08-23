import { describe, expect, it } from "vitest";
import { commitsRequiringShapeValidation } from "../../scripts/qa-commit-policy.mjs";

const squashCommit = {
  sha: "2c62a5b364385565d484935ab4b76679779a4c12",
  subject: "GOV-1: hardwire Destiny harness governance (#9)",
};

describe("protected main commit reachability", () => {
  it("exempts a protected squash commit already reachable from origin/main", () => {
    expect(commitsRequiringShapeValidation({
      commits: [squashCommit],
      protectedMainReachableShas: new Set([squashCommit.sha]),
    })).toEqual([]);
  });

  it("keeps an identical squash subject strict outside protected origin/main", () => {
    expect(commitsRequiringShapeValidation({
      commits: [squashCommit],
      protectedMainReachableShas: new Set(["fc7f050e1201ff5ee6ebece98560592257de127f"]),
    })).toEqual([squashCommit]);
  });

  it("continues validating compliant TDD commits outside protected origin/main", () => {
    const branchCommit = {
      sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      subject: "red: prove the protected main boundary",
    };
    expect(commitsRequiringShapeValidation({
      commits: [branchCommit],
      protectedMainReachableShas: new Set([squashCommit.sha]),
    })).toEqual([branchCommit]);
  });

  it("fails closed when protected origin/main reachability is unavailable", () => {
    expect(() => commitsRequiringShapeValidation({
      commits: [squashCommit],
      protectedMainReachableShas: new Set(),
    })).toThrow(/origin\/main.*reachability/i);
  });
});
