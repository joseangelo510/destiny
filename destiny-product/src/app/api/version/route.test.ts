import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const stampPath = path.join(process.cwd(), ".generated", "build-stamp.json");
const sha = "1234567890abcdef1234567890abcdef12345678";
const tree = "abcdef1234567890abcdef1234567890abcdef12";
let priorStamp: string | null = null;

beforeEach(async () => {
  priorStamp = await readFile(stampPath, "utf8").catch(() => null);
  await mkdir(path.dirname(stampPath), { recursive: true });
  await writeFile(stampPath, JSON.stringify({
    sha,
    tree,
    builtAt: "2026-08-24T18:00:00.000Z",
    env: "test",
  }));
});

afterEach(async () => {
  if (priorStamp === null) await rm(stampPath, { force: true });
  else await writeFile(stampPath, priorStamp);
});

describe("GET /api/version", () => {
  it("returns the build-generated provenance without caching", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      sha,
      tree,
      builtAt: "2026-08-24T18:00:00.000Z",
      env: "test",
    });
  });

  it("fails the production preflight when provenance is unknown", () => {
    const result = spawnSync(process.execPath, [
      "scripts/qa-live-version.mjs",
      "--fixture",
      "qa/fixtures/version-unknown.json",
      "--expected-sha",
      sha,
    ], { cwd: process.cwd(), encoding: "utf8" });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/unknown|provenance/i);
  });

  it("passes the production preflight only for the expected SHA and tree", async () => {
    const fixturePath = path.join(process.cwd(), ".generated", "valid-version-fixture.json");
    await writeFile(fixturePath, JSON.stringify({
      sha,
      tree,
      builtAt: "2026-08-24T18:00:00.000Z",
      env: "test",
    }));

    const result = spawnSync(process.execPath, [
      "scripts/qa-live-version.mjs",
      "--fixture",
      fixturePath,
      "--expected-sha",
      sha,
      "--expected-tree",
      tree,
    ], { cwd: process.cwd(), encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/P1 PASS/);
  });

  it("writes the current Git commit and tree into the build stamp", () => {
    execFileSync(process.execPath, ["scripts/write-build-stamp.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DESTINY_RUNTIME_ENV: "test-build" },
    });
    const expectedSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();
    const expectedTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();
    const stamp = JSON.parse(execFileSync(process.execPath, [
      "-e",
      "process.stdout.write(require('node:fs').readFileSync('.generated/build-stamp.json','utf8'))",
    ], { cwd: process.cwd(), encoding: "utf8" }));

    expect(stamp.sha).toBe(expectedSha);
    expect(stamp.tree).toBe(expectedTree);
    expect(stamp.env).toBe("test-build");
    expect(Number.isNaN(Date.parse(stamp.builtAt))).toBe(false);
  });
});
