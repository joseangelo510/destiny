const LOWER_IS_BETTER = new Set([
  "architectureViolations",
  "auditExceptions",
  "changedMaximumFunctionComplexity",
  "dependencyCycles",
  "duplicateBlocks",
  "duplicationPercentage",
  "eslintWarnings",
  "flakyRetries",
  "maximumCyclomaticComplexity",
  "quarantinedTests",
  "skippedTests",
  "typeErrors",
]);
const HIGHER_IS_BETTER = new Set([
  "apiContractCoverage",
  "browserJourneyCoverage",
  "changedBranchCoverage",
  "changedLineCoverage",
  "changedMutationScore",
  "routeJourneyCoverage",
]);
const INFORMATIONAL = new Set(["testCount"]);
const GHSA = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
const ANSI = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const WARNING_LINE = /(?:Module not found:|Critical dependency:|WARNING in\b|(?:DeprecationWarning|ExperimentalWarning|Warning):)/;

export function compareRatchetMetrics(baseline, current, { ceilings = {} } = {}) {
  const errors = [];
  for (const [metric, limit] of Object.entries(ceilings)) {
    if (Number.isFinite(current[metric]) && current[metric] > limit) {
      errors.push(`${metric} exceeded its ${limit} ceiling with ${current[metric]}.`);
    }
  }
  for (const [metric, oldValue] of Object.entries(baseline)) {
    if (INFORMATIONAL.has(metric) || !(metric in current)) continue;
    const newValue = current[metric];
    if (!Number.isFinite(oldValue) || !Number.isFinite(newValue)) continue;
    if (LOWER_IS_BETTER.has(metric) && newValue > oldValue) errors.push(`${metric} worsened from ${oldValue} to ${newValue}.`);
    if (HIGHER_IS_BETTER.has(metric) && newValue < oldValue) errors.push(`${metric} worsened from ${oldValue} to ${newValue}.`);
  }
  return errors;
}

export function validateRatchetException(exception, now = new Date()) {
  const errors = [];
  if (!/^D-[A-Z0-9-]+$/.test(exception?.decisionId ?? "")) errors.push("Ratchet exception requires a Fable High decision ID.");
  if (!exception?.owner) errors.push("Ratchet exception requires an owner.");
  if (!exception?.reason) errors.push("Ratchet exception requires a reason.");
  if (!exception?.expiresAt) errors.push("Ratchet exception requires an expiry.");
  else if (Number.isNaN(Date.parse(exception.expiresAt))) errors.push("Ratchet exception expiry is invalid.");
  else if (new Date(exception.expiresAt) <= now) errors.push("Ratchet exception has expired.");
  return errors;
}

function validateAuditException(exception, { testFiles, now }) {
  const errors = [];
  const ghsa = exception?.ghsa || "<missing>";
  if (!GHSA.test(ghsa)) errors.push(`Audit exception GHSA is invalid: ${ghsa}.`);
  if (!exception?.owner) errors.push(`Audit exception ${ghsa} requires an owner.`);
  if (!exception?.reason) errors.push(`Audit exception ${ghsa} requires a reason.`);
  if (!exception?.boundaryTest || !testFiles.has(exception.boundaryTest)) {
    errors.push(`Audit exception ${ghsa} boundary test does not exist: ${exception?.boundaryTest || "<missing>"}.`);
  }
  if (!exception?.expiresAt || Number.isNaN(Date.parse(exception.expiresAt))) {
    errors.push(`Audit exception ${ghsa} expiry is invalid.`);
  } else if (new Date(exception.expiresAt) <= now) errors.push(`Audit exception ${ghsa} has expired.`);
  return { errors, ghsa };
}

function validateExactAuditMapping(typed, ignored) {
  const errors = [];
  for (const ghsa of ignored) if (!typed.has(ghsa)) errors.push(`Ignored GHSA lacks a typed exception: ${ghsa}.`);
  for (const ghsa of typed) if (!ignored.has(ghsa)) errors.push(`Typed audit exception is not ignored by pnpm: ${ghsa}.`);
  return errors;
}

export function validateAuditExceptions(policy, { ignoredGhsas = [], testFiles = new Set(), now = new Date() } = {}) {
  const errors = [];
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return ["Audit exception policy must be an object."];
  if (policy.schemaVersion !== "2.0.0") errors.push("Audit exception policy schemaVersion must be 2.0.0.");
  if (!Array.isArray(policy.exceptions)) return [...errors, "Audit exception policy requires an exceptions array."];
  const typed = new Set();
  for (const exception of policy.exceptions) {
    const result = validateAuditException(exception, { testFiles, now });
    const { ghsa } = result;
    if (typed.has(ghsa)) errors.push(`Audit exception is duplicated: ${ghsa}.`);
    typed.add(ghsa);
    errors.push(...result.errors);
  }
  errors.push(...validateExactAuditMapping(typed, new Set(ignoredGhsas)));
  return [...new Set(errors)];
}

function occurrences(text, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = text.indexOf(needle, offset)) >= 0) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function validateWarningAllowance(warning, { ids, output, now }) {
  const errors = [];
  const id = warning?.id || "<missing>";
  if (ids.has(id)) errors.push(`Build warning allowance is duplicated: ${id}.`);
  ids.add(id);
  if (!warning?.owner) errors.push(`Build warning ${id} requires an owner.`);
  if (!warning?.reason) errors.push(`Build warning ${id} requires a reason.`);
  if (!warning?.fingerprint) errors.push(`Build warning ${id} requires a fingerprint.`);
  const count = warning?.fingerprint ? occurrences(output, warning.fingerprint) : 0;
  if (count === 0) errors.push(`Declared build warning disappeared; remove its allowance: ${id}.`);
  if (count > 1) errors.push(`Build warning ${id} occurred ${count} times; expected exactly 1.`);
  if (!warning?.expiresAt || Number.isNaN(Date.parse(warning.expiresAt))) {
    errors.push(`Build warning ${id} expiry is invalid.`);
  } else if (new Date(warning.expiresAt) <= now) errors.push(`Build warning allowance has expired: ${id}.`);
  return { errors, matched: { count, id } };
}

function findUnknownWarnings(output, warnings) {
  const fingerprints = warnings.map((warning) => warning.fingerprint).filter(Boolean);
  return output.split("\n")
    .map((line) => line.trim())
    .filter((line) => WARNING_LINE.test(line))
    .filter((line) => !fingerprints.some((fingerprint) => line.includes(fingerprint)));
}

function warningPolicyShapeErrors(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return ["Build warning policy must be an object."];
  const errors = policy.schemaVersion === "2.0.0" ? [] : ["Build warning policy schemaVersion must be 2.0.0."];
  if (!Array.isArray(policy.warnings)) errors.push("Build warning policy requires a warnings array.");
  return errors;
}

export function evaluateBuildWarnings(rawOutput, policy, now = new Date()) {
  const output = String(rawOutput ?? "").replace(ANSI, "");
  const errors = warningPolicyShapeErrors(policy);
  if (!policy || !Array.isArray(policy.warnings)) return { errors, matched: [], unknownWarnings: [] };
  const matched = [];
  const ids = new Set();
  for (const warning of policy.warnings) {
    const result = validateWarningAllowance(warning, { ids, output, now });
    errors.push(...result.errors);
    matched.push(result.matched);
  }
  const unknownWarnings = findUnknownWarnings(output, policy.warnings);
  for (const line of unknownWarnings) errors.push(`Unknown build warning: ${line}`);
  if (/(?:⚠\s*)?Compiled with warnings\b/.test(output) && matched.every((warning) => warning.count === 0)) {
    errors.push("Build reported warnings without a recognized fingerprint.");
  }
  return { errors: [...new Set(errors)], matched, unknownWarnings: [...new Set(unknownWarnings)] };
}

export function validateBuildProvenance({ buildScript, prebuildScript, runnerSource = "" } = {}) {
  const errors = [];
  if (buildScript !== "node scripts/qa-build.mjs") {
    errors.push("Production build must route through scripts/qa-build.mjs.");
  }
  if (prebuildScript !== undefined) {
    errors.push("Production build must not use a bypassable prebuild lifecycle hook.");
  }
  const stamp = runnerSource.indexOf("write-build-stamp.mjs");
  const build = runnerSource.indexOf('["next", "build", "--webpack"]');
  const warningEvaluation = runnerSource.indexOf("const evaluation = evaluateBuildWarnings(");
  const receipt = runnerSource.indexOf("writeFile(artifactPath");
  if (stamp < 0) errors.push("Production build wrapper must create a build stamp.");
  if (build < 0) errors.push("Production build wrapper must invoke Next.js with webpack.");
  if (stamp >= 0 && build >= 0 && stamp > build) errors.push("Build stamp must run before the Next.js production build.");
  if (warningEvaluation < 0 || (build >= 0 && warningEvaluation < build)) {
    errors.push("Build warnings must be evaluated after the production build.");
  }
  if (receipt < 0) errors.push("Production build must persist its evidence receipt.");
  if (receipt >= 0 && warningEvaluation >= 0 && receipt < warningEvaluation) {
    errors.push("Production build receipt must be written after warning evaluation.");
  }
  return errors;
}
