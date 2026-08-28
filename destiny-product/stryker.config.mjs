const mutate = JSON.parse(process.env.QA_MUTATION_TARGETS ?? "[]");
if (!Array.isArray(mutate) || mutate.length === 0) throw new Error("QA_MUTATION_TARGETS must contain changed source files.");

export default {
  mutate,
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.sota.config.mjs",
    related: false,
  },
  coverageAnalysis: "perTest",
  // Static module-initialization mutants leak across Vitest workers and make
  // identical runs order-dependent. Mutate executable boundaries instead.
  ignoreStatic: true,
  reporters: ["clear-text", "json"],
  jsonReporter: {
    fileName: process.env.QA_MUTATION_REPORT ?? "qa/artifacts/harness/mutation/mutation.json",
  },
  thresholds: {
    high: 80,
    low: 60,
    break: 60,
  },
  concurrency: 2,
  timeoutMS: 10_000,
  dryRunTimeoutMinutes: 2,
  tempDirName: ".stryker-tmp",
  cleanTempDir: "always",
  allowConsoleColors: false,
};
