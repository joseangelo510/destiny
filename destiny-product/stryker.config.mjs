const mutate = JSON.parse(process.env.QA_MUTATION_TARGETS ?? "[]");
if (!Array.isArray(mutate) || mutate.length === 0) throw new Error("QA_MUTATION_TARGETS must contain changed source files.");

const config = {
  mutate,
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.sota.config.mjs",
    related: false,
  },
  coverageAnalysis: "perTest",
  // Top-level policies and regex contracts are production behavior. Execute
  // their mutants in fresh test runs instead of classifying them as survivors.
  ignoreStatic: false,
  reporters: ["clear-text", "json"],
  jsonReporter: {
    fileName: process.env.QA_MUTATION_REPORT ?? "qa/artifacts/harness/mutation/mutation.json",
  },
  thresholds: {
    high: 80,
    low: 69,
    break: 69,
  },
  concurrency: 4,
  timeoutMS: 10_000,
  dryRunTimeoutMinutes: 2,
  tempDirName: ".stryker-tmp",
  cleanTempDir: "always",
  allowConsoleColors: false,
};

export default config;
