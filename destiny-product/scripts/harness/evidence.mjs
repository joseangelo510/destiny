const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "changeId",
  "classification",
  "decision",
  "redReplay",
  "networkMode",
  "touchedRoutes",
  "productPaths",
]);
const NETWORK_MODES = new Set(["mocked", "local-isolated", "staging-readonly", "authorized-live"]);
const EXEMPTIONS = new Set(["decision-record-only", "docs-only", "protected-revert", "generated-inventory-only"]);
const SHA = /^[0-9a-f]{40}$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

function required(errors, value, field) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    errors.push(`Evidence requires ${field}.`);
    return false;
  }
  return true;
}

export function validateEvidenceManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return ["Evidence manifest must be an object."];
  for (const key of Object.keys(manifest)) if (!TOP_LEVEL_FIELDS.has(key)) errors.push(`Unexpected evidence field: ${key}.`);
  if (manifest.schemaVersion !== "2.0.0") errors.push("Evidence schemaVersion must be 2.0.0.");
  if (!/^[A-Z0-9][A-Z0-9._-]{2,79}$/.test(manifest.changeId ?? "")) errors.push("Evidence changeId is invalid.");
  if (!new Set(["MEDIUM", "HIGH"]).has(manifest.classification)) errors.push("Evidence classification must be MEDIUM or HIGH.");
  if (manifest.classification === "HIGH") {
    required(errors, manifest.decision?.id, "decision.id");
    if (!/^destiny-product\/DEPLOY_LOG\.md(?:#[-a-z0-9]+)?$/.test(manifest.decision?.path ?? "")) {
      errors.push("HIGH evidence decision.path must point to destiny-product/DEPLOY_LOG.md.");
    }
  }
  if (!NETWORK_MODES.has(manifest.networkMode)) errors.push("Evidence networkMode is invalid.");
  if (!Array.isArray(manifest.touchedRoutes)) errors.push("Evidence touchedRoutes must be an array.");
  if (!Array.isArray(manifest.productPaths)) errors.push("Evidence productPaths must be an array.");

  const replay = manifest.redReplay;
  if (!replay || typeof replay !== "object") errors.push("Evidence requires redReplay.");
  else if (replay.mode === "required") {
    if (!SHA.test(replay.redCommit ?? "")) errors.push("Evidence requires a full redReplay.redCommit SHA.");
    if (!required(errors, replay.command, "redReplay.command") || replay.command.some((item) => typeof item !== "string" || !item)) {
      errors.push("redReplay.command must be a non-empty argv array.");
    }
    required(errors, replay.failurePattern, "redReplay.failurePattern");
    if (!required(errors, replay.testFiles, "redReplay.testFiles") || replay.testFiles.some((file) => !TEST_FILE.test(file))) {
      errors.push("redReplay.testFiles must contain test files only.");
    }
    required(errors, replay.implementationPaths, "redReplay.implementationPaths");
  } else if (replay.mode === "not-applicable") {
    if (!EXEMPTIONS.has(replay.exemption)) errors.push("RED exemption is not allowed.");
  } else errors.push("redReplay.mode must be required or not-applicable.");
  return [...new Set(errors)];
}

function onlyMatches(files, pattern) {
  return files.length > 0 && files.every((file) => pattern.test(file));
}

export function evaluateEvidenceManifest(manifest, { changedFiles = [], isProtectedRevert = false } = {}) {
  const errors = validateEvidenceManifest(manifest);
  const replay = manifest?.redReplay;
  if (replay?.mode !== "not-applicable") return errors;
  const matches = {
    "decision-record-only": onlyMatches(changedFiles, /^destiny-product\/DEPLOY_LOG\.md$/),
    "docs-only": onlyMatches(changedFiles, /^(?:docs\/|destiny-product\/docs\/|README\.md$|.*\.md$)/),
    "protected-revert": isProtectedRevert,
    "generated-inventory-only": onlyMatches(changedFiles, /^destiny-product\/qa\/inventory\//),
  };
  if (!matches[replay.exemption]) errors.push(`RED exemption ${replay.exemption} does not match the changed files.`);
  return [...new Set(errors)];
}
