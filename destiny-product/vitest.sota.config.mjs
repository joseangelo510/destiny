import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.mjs";

export default mergeConfig(base, defineConfig({
  test: {
    include: [
      "qa/rules/harness-*-v2.test.ts",
      "src/lib/observability/logging.test.ts",
    ],
  },
}));
