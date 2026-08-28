const LOWER_IS_BETTER = new Set([
  "architectureViolations",
  "auditExceptions",
  "dependencyCycles",
  "duplicateBlocks",
  "eslintWarnings",
  "flakyRetries",
  "quarantinedTests",
  "skippedTests",
  "typeErrors",
]);
const HIGHER_IS_BETTER = new Set([
  "changedBranchCoverage",
  "changedLineCoverage",
  "changedMutationScore",
  "routeJourneyCoverage",
]);
const INFORMATIONAL = new Set(["testCount"]);

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
