import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const stampPath = path.join(process.cwd(), ".generated", "build-stamp.json");
const sha = "1234567890abcdef1234567890abcdef12345678";
const tree = "abcdef1234567890abcdef1234567890abcdef12";
const unknownStamp = { sha: "unknown", tree: "unknown", builtAt: "unknown", env: "unknown" };
let priorStamp: string | null = null;

function versionRequest() {
  return new Request("http://localhost/api/version");
}

function expectBuildIdentity(log: ReturnType<typeof vi.spyOn>, known: boolean) {
  expect(JSON.parse(String(log.mock.calls[0][0])).context).toEqual({ buildIdentityKnown: known });
}

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
    const response = await GET(versionRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      sha,
      tree,
      builtAt: "2026-08-24T18:00:00.000Z",
      env: "test",
    });
  });

  it("propagates correlation identity and emits a redacted structured event", async () => {
    const correlationId = "018f3f5d-3e16-7c2a-9f2e-3c227fd77e11";
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await GET(new Request("http://localhost/api/version", {
      headers: { "x-correlation-id": correlationId, authorization: "Bearer private" },
    }));

    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
    expect(log).toHaveBeenCalledOnce();
    const event = String(log.mock.calls[0][0]);
    expect(event).not.toContain("private");
    expect(JSON.parse(event)).toEqual(expect.objectContaining({
      schemaVersion: "1.0.0",
      correlationId,
      event: "version.read",
      severity: "info",
      context: { buildIdentityKnown: true },
    }));
    log.mockRestore();
  });

  it("fails closed for malformed or partially trusted build stamps", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const invalidSha = `x${sha}`;
    await writeFile(stampPath, JSON.stringify({
      sha: invalidSha,
      tree: `${tree}x`,
      builtAt: "not-a-date",
      env: "unknown",
    }));
    const response = await GET(versionRequest());
    await expect(response.json()).resolves.toEqual(unknownStamp);
    expectBuildIdentity(log, false);
    log.mockRestore();
  });

  it("normalizes environment whitespace but rejects arrays and missing fields", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await writeFile(stampPath, JSON.stringify({ sha, tree, builtAt: "2026-08-27", env: "  preview  " }));
    await expect((await GET(versionRequest())).json()).resolves.toEqual({ sha, tree, builtAt: "2026-08-27", env: "preview" });
    await writeFile(stampPath, "[]");
    await expect((await GET(versionRequest())).json()).resolves.toEqual(unknownStamp);
    await writeFile(stampPath, "null");
    await expect((await GET(versionRequest())).json()).resolves.toEqual(unknownStamp);
    for (const primitive of ["7", '"stamp"', "true", "{not-json"]) {
      await writeFile(stampPath, primitive);
      await expect((await GET(versionRequest())).json()).resolves.toEqual(unknownStamp);
    }
    await writeFile(stampPath, JSON.stringify({ sha: true, tree: 7, builtAt: false, env: [] }));
    await expect((await GET(versionRequest())).json()).resolves.toEqual(unknownStamp);
    log.mockRestore();
  });

  it("fails closed when the build stamp is absent", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await rm(stampPath, { force: true });
    await expect((await GET(versionRequest())).json()).resolves.toEqual(unknownStamp);
    expectBuildIdentity(log, false);
    log.mockRestore();
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
