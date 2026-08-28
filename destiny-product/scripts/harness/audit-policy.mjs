const GHSA = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;

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
  const ignored = new Set(ignoredGhsas);
  errors.push(...validateExactAuditMapping(typed, ignored));
  return [...new Set(errors)];
}
