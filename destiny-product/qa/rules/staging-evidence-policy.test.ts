import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertExactHead,
  assertZero5xx,
} from "../../scripts/staging-evidence.mjs";

const repositoryRoot = path.resolve(process.cwd(), "..");

describe("CI-ephemeral staging evidence policy", () => {
  it("checks out the exact PR head and never targets an external deployment", async () => {
    const workflow = await readFile(
      path.join(repositoryRoot, ".github/workflows/staging-evidence.yml"),
      "utf8",
    );

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("types: [opened, synchronize, reopened]");
    expect(workflow).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(workflow).toContain("DESTINY_EXPECTED_SHA: ${{ github.event.pull_request.head.sha }}");
    expect(workflow).toContain("destiny-product/qa/artifacts/staging-evidence");
    expect(workflow).not.toMatch(/secrets\.|flyctl|replit|vercel|docker\s+(?:push|login)/i);
  });

  it("fails closed on identity mismatch or a 5xx route", () => {
    expect(() => assertExactHead({
      eventSha: "a".repeat(40),
      gitSha: "a".repeat(40),
      stampSha: "a".repeat(40),
    })).not.toThrow();
    expect(() => assertExactHead({
      eventSha: "b".repeat(40),
      gitSha: "a".repeat(40),
      stampSha: "a".repeat(40),
    })).toThrow(/identity mismatch/i);

    expect(() => assertZero5xx([
      { route: "/", status: 200 },
      { route: "/api/version", status: 200 },
    ])).not.toThrow();
    expect(() => assertZero5xx([
      { route: "/api/version", status: 503 },
    ])).toThrow(/zero 5xx/i);
  });
});
