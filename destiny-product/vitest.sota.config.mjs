import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.mjs";

export default mergeConfig(base, defineConfig({
  test: {
    include: [
      "qa/rules/harness-*-v2.test.ts",
      "qa/rules/dependency-audit-policy.test.ts",
      "qa/rules/build-provenance-policy.test.ts",
      "qa/mutation/**/*.test.ts",
      "src/app/api/version/route.test.ts",
      "src/lib/observability/logging.test.ts",
    ],
    exclude: [
      "qa/rules/harness-governance-v2.test.ts",
      "qa/rules/harness-integration-v2.test.ts",
    ],
  },
}));
