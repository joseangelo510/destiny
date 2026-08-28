import { describe, expect, it } from "vitest";
import * as architecture from "../../scripts/harness/architecture.mjs";
import * as capabilities from "../../scripts/harness/capabilities.mjs";
import * as evidence from "../../scripts/harness/evidence.mjs";
import * as flake from "../../scripts/harness/flake.mjs";
import * as networkPolicy from "../../scripts/harness/network-policy.mjs";
import * as quality from "../../scripts/harness/quality.mjs";
import * as ratchet from "../../scripts/harness/ratchet.mjs";
import * as redReplay from "../../scripts/harness/red-replay.mjs";
import * as repository from "../../scripts/harness/repository.mjs";
import * as trace from "../../scripts/harness/trace.mjs";

describe("static mutation module isolation", () => {
  it("loads every changed harness policy in the mutation worker", () => {
    for (const harnessModule of [
      architecture, capabilities, evidence, flake, networkPolicy,
      quality, ratchet, redReplay, repository, trace,
    ]) expect(Object.keys(harnessModule).length).toBeGreaterThan(0);
  });
});
