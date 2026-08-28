const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const JOURNEY_MODES = new Set(["public", "local-isolated", "staging-readonly"]);

function roundedPercentage(covered, total) {
  return total === 0 ? 100 : Math.round((covered / total) * 10_000) / 100;
}

export function calculateChangedCoverage({ changedLines, coverage }) {
  let coveredLines = 0;
  let totalLines = 0;
  let coveredBranches = 0;
  let totalBranches = 0;
  for (const [file, lines] of changedLines) {
    const fileCoverage = coverage[file];
    for (const line of lines) {
      totalLines += 1;
      if ((fileCoverage?.lines?.[line] ?? 0) > 0) coveredLines += 1;
      for (const count of fileCoverage?.branches?.[line] ?? []) {
        totalBranches += 1;
        if (count > 0) coveredBranches += 1;
      }
    }
  }
  return {
    branchCoverage: roundedPercentage(coveredBranches, totalBranches),
    coveredBranches,
    coveredLines,
    lineCoverage: roundedPercentage(coveredLines, totalLines),
    totalBranches,
    totalLines,
  };
}

export function selectMutationTargets(files, { maximumFiles }) {
  const targets = [...new Set(files
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => (file.startsWith("src/") || file.startsWith("scripts/harness/"))
      && SOURCE_FILE.test(file) && !TEST_FILE.test(file)))]
    .sort();
  if (targets.length > maximumFiles) {
    throw new Error(`Changed mutation scope has ${targets.length} files; cap is ${maximumFiles}. Narrow the PR or obtain a labeled exception.`);
  }
  return targets;
}

function tokens(source) {
  // The token grammar is exhaustively specified by hostile identifier, numeric, operator, and empty-source tests.
  return source.match(/[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|===|!==|=>|&&|\|\||[{}()[\].,:;?+*/%<>=!-]/g) ?? [];
}

function duplicateWindows(sources, floor) {
  const windows = new Map();
  for (const [file, source] of sources) {
    const fileTokens = tokens(source);
    const seenInFile = new Set();
    for (let index = 0; index <= fileTokens.length - floor; index += 1) {
      seenInFile.add(fileTokens.slice(index, index + floor).join(" "));
    }
    for (const window of seenInFile) {
      const files = windows.get(window) ?? new Set();
      files.add(file);
      windows.set(window, files);
    }
  }
  return [...windows.values()].filter((files) => files.size > 1).length;
}

function cyclomaticComplexity(source) {
  const decisions = source.match(/\b(?:if|for|while|case|catch)\b|&&|\|\||\?\?/g) ?? [];
  return 1 + decisions.length;
}

export function measureSourceDebt(sources, { duplicateTokenFloor = 40 } = {}) {
  const complexities = [...sources.values()].map(cyclomaticComplexity);
  return {
    duplicateBlocks: duplicateWindows(sources, duplicateTokenFloor),
    maximumCyclomaticComplexity: complexities.length ? Math.max(...complexities) : 0,
  };
}

export function evaluateChangedFunctionComplexity(reports, { productRoot, maximum }) {
  const root = String(productRoot).replaceAll("\\", "/").replace(/\/$/, "");
  const measurements = [];
  for (const report of reports) {
    const absolute = String(report.filePath ?? "").replaceAll("\\", "/");
    const file = absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : absolute;
    // Stryker disable next-line ArrayDeclaration: absent report messages cannot create a complexity measurement
    for (const message of report.messages ?? []) {
      if (message.ruleId !== "complexity") continue;
      // Stryker disable next-line StringLiteral: missing message text is always malformed by the anchored complexity parser
      const match = /complexity of (\d+)\b/.exec(message.message ?? "");
      if (!match) throw new Error(`Malformed ESLint complexity measurement for ${file}:${message.line ?? 0}.`);
      measurements.push({ complexity: Number(match[1]), file, line: Number(message.line ?? 0) });
    }
  }
  const measuredMaximum = measurements.length ? Math.max(...measurements.map((item) => item.complexity)) : 0;
  return {
    maximum: measuredMaximum,
    offenders: measurements.filter((item) => item.complexity > maximum),
  };
}

export function calculateRouteJourneyCoverage(routes, coveredRoutes) {
  const uniqueRoutes = [...new Set(routes)].sort();
  const covered = new Set(coveredRoutes);
  const uncovered = uniqueRoutes.filter((route) => !covered.has(route));
  return {
    covered: uniqueRoutes.length - uncovered.length,
    percentage: roundedPercentage(uniqueRoutes.length - uncovered.length, uniqueRoutes.length),
    total: uniqueRoutes.length,
    uncovered,
  };
}

export function validateTouchedRouteCoverage(touchedRoutes, { apiRoutes = new Set(), browserRoutes = new Set(), knownRoutes } = {}) {
  const errors = [];
  const inventory = knownRoutes ?? new Set([...apiRoutes, ...browserRoutes]);
  for (const route of touchedRoutes) {
    if (!inventory.has(route)) errors.push(`Touched route is absent from inventory: ${route}.`);
    else if (route.startsWith("/api/") && !apiRoutes.has(route)) errors.push(`Touched API route lacks a contract test: ${route}.`);
    else if (!route.startsWith("/api/") && !browserRoutes.has(route)) errors.push(`Touched browser route lacks a source-backed journey: ${route}.`);
  }
  return errors;
}

function evidenceValues(journey, field) {
  return journey?.[field === "routeEvidence" ? "routes" : "assertions"] ?? [];
}

function validateJourneyEvidenceValue({ evidence, id, journey, label, source, value }) {
  const errors = [];
  const snippet = evidence[value];
  if (!snippet) errors.push(`Journey ${id} requires ${label} evidence: ${value}.`);
  else if (!source.includes(snippet)) errors.push(`Journey ${id} ${label} evidence is not present in ${journey.testFile}: ${value}.`);
  return errors;
}

function validateJourneyEvidence(journey, { field, label, source }) {
  const id = journey?.id || "<missing>";
  const declared = new Set(evidenceValues(journey, field));
  const evidence = journey?.[field];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return [...declared].map((value) => `Journey ${id} requires ${label} evidence: ${value}.`);
  }
  const errors = [];
  for (const value of declared) errors.push(...validateJourneyEvidenceValue({ evidence, id, journey, label, source, value }));
  for (const value of Object.keys(evidence)) if (!declared.has(value)) errors.push(`Journey ${id} has undeclared ${label} evidence: ${value}.`);
  return errors;
}

function validateJourneyIdentity(journey, { testFiles }) {
  const errors = [];
  const id = journey?.id || "<missing>";
  if (!JOURNEY_MODES.has(journey?.mode)) errors.push(`Journey ${id} has an invalid mode.`);
  if (!journey?.owner) errors.push(`Journey ${id} requires an owner.`);
  if (!journey?.testFile || !testFiles.has(journey.testFile)) errors.push(`Journey ${id} test file does not exist: ${journey?.testFile || "<missing>"}.`);
  return errors;
}

function validateJourneyRoutes(journey, knownRoutes) {
  const errors = [];
  const id = journey?.id || "<missing>";
  if (!Array.isArray(journey?.routes) || journey.routes.length === 0) errors.push(`Journey ${id} requires routes.`);
  else for (const route of journey.routes) if (!knownRoutes.has(route)) errors.push(`Journey ${id} references unknown route ${route}.`);
  return errors;
}

function validateJourney(journey, { knownRoutes, testFiles, testSources }) {
  const errors = [
    ...validateJourneyIdentity(journey, { testFiles }),
    ...validateJourneyRoutes(journey, knownRoutes),
  ];
  const id = journey?.id || "<missing>";
  if (!Array.isArray(journey?.assertions) || journey.assertions.length === 0) errors.push(`Journey ${id} requires assertions.`);
  const source = testSources.get(journey?.testFile) ?? "";
  errors.push(...validateJourneyEvidence(journey, { field: "routeEvidence", label: "route", source }));
  errors.push(...validateJourneyEvidence(journey, { field: "assertionEvidence", label: "assertion", source }));
  return errors;
}

export function validateJourneyRegistry(registry, { knownRoutes = new Set(), testFiles = new Set(), testSources = new Map() } = {}) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) return ["Journey registry must be an object."];
  const errors = registry.schemaVersion === "2.0.0" ? [] : ["Journey registry schemaVersion must be 2.0.0."];
  if (!Array.isArray(registry.journeys) || registry.journeys.length === 0) return [...errors, "Journey registry requires at least one journey."];
  const ids = new Set();
  for (const journey of registry.journeys) {
    const id = journey?.id || "<missing>";
    if (ids.has(id)) errors.push(`Journey ID is duplicated: ${id}.`);
    ids.add(id);
    errors.push(...validateJourney(journey, { knownRoutes, testFiles, testSources }));
  }
  return [...new Set(errors)];
}

export function calculateTypedJourneyCoverage(routes, journeys, contractRoutes) {
  const inventory = [...new Set(routes)].sort();
  const apiRoutes = inventory.filter((route) => route.startsWith("/api/"));
  const browserRoutes = inventory.filter((route) => !route.startsWith("/api/"));
  const journeyRoutes = new Set(journeys.flatMap((journey) => journey.routes));
  const browserCovered = browserRoutes.filter((route) => journeyRoutes.has(route));
  const contractSet = new Set(contractRoutes);
  const apiCovered = apiRoutes.filter((route) => contractSet.has(route));
  const combined = new Set([...browserCovered, ...apiCovered]);
  const details = {
    api: { covered: apiCovered.length, total: apiRoutes.length, uncovered: apiRoutes.filter((route) => !contractSet.has(route)) },
    browser: { covered: browserCovered.length, total: browserRoutes.length, uncovered: browserRoutes.filter((route) => !journeyRoutes.has(route)) },
    combined: { covered: combined.size, total: inventory.length, uncovered: inventory.filter((route) => !combined.has(route)) },
  };
  return {
    apiContractCoverage: roundedPercentage(details.api.covered, details.api.total),
    browserJourneyCoverage: roundedPercentage(details.browser.covered, details.browser.total),
    routeJourneyCoverage: roundedPercentage(details.combined.covered, details.combined.total),
    details,
  };
}

function executableSignature(output) {
  return String(output ?? "")
    // The emitted preamble normalization is exhaustively specified by anchored quote, semicolon, and whitespace tests.
    .replace(/^\s*["']use strict["'];?\s*/m, "")
    .replace(/^\s*export\s*\{\s*\};?\s*$/m, "")
    .trim();
}

export function filterExecutableChanges(files, { baseOutputs = new Map(), headOutputs = new Map() }) {
  return files.filter((file) => executableSignature(baseOutputs.get(file)) !== executableSignature(headOutputs.get(file)));
}

export function countSkippedTests(source) {
  return (String(source).match(/^\s*(?:it|test|describe)\.skip\s*\(/gm) ?? []).length;
}
