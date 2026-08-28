const ANSI = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const WARNING_LINE = /(?:Module not found:|Critical dependency:|WARNING in\b|(?:DeprecationWarning|ExperimentalWarning|Warning):)/;

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

export function evaluateBuildWarnings(rawOutput, policy, now = new Date()) {
  const output = String(rawOutput ?? "").replace(ANSI, "");
  const errors = [];
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    return { errors: ["Build warning policy must be an object."], matched: [], unknownWarnings: [] };
  }
  if (policy.schemaVersion !== "2.0.0") errors.push("Build warning policy schemaVersion must be 2.0.0.");
  if (!Array.isArray(policy.warnings)) return { errors: [...errors, "Build warning policy requires a warnings array."], matched: [], unknownWarnings: [] };
  const matched = [];
  const ids = new Set();
  for (const warning of policy.warnings) {
    const result = validateWarningAllowance(warning, { ids, output, now });
    errors.push(...result.errors);
    matched.push(result.matched);
  }
  const unknownWarnings = findUnknownWarnings(output, policy.warnings);
  for (const line of unknownWarnings) errors.push(`Unknown build warning: ${line}`);
  const compiledWithWarnings = /(?:⚠\s*)?Compiled with warnings\b/.test(output);
  if (compiledWithWarnings && matched.every((warning) => warning.count === 0)) {
    errors.push("Build reported warnings without a recognized fingerprint.");
  }
  return { errors: [...new Set(errors)], matched, unknownWarnings: [...new Set(unknownWarnings)] };
}
