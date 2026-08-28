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

export function validateJourneyRegistry(registry, { knownRoutes = new Set(), testFiles = new Set() } = {}) {
  const errors = [];
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) return ["Journey registry must be an object."];
  if (registry.schemaVersion !== "2.0.0") errors.push("Journey registry schemaVersion must be 2.0.0.");
  if (!Array.isArray(registry.journeys) || registry.journeys.length === 0) {
    errors.push("Journey registry requires at least one journey.");
    return errors;
  }
  const ids = new Set();
  for (const journey of registry.journeys) {
    const id = journey?.id || "<missing>";
    if (ids.has(id)) errors.push(`Journey ID is duplicated: ${id}.`);
    ids.add(id);
    if (!JOURNEY_MODES.has(journey?.mode)) errors.push(`Journey ${id} has an invalid mode.`);
    if (!journey?.owner) errors.push(`Journey ${id} requires an owner.`);
    if (!journey?.testFile || !testFiles.has(journey.testFile)) errors.push(`Journey ${id} test file does not exist: ${journey?.testFile || "<missing>"}.`);
    if (!Array.isArray(journey?.routes) || journey.routes.length === 0) errors.push(`Journey ${id} requires routes.`);
    else for (const route of journey.routes) if (!knownRoutes.has(route)) errors.push(`Journey ${id} references unknown route ${route}.`);
    if (!Array.isArray(journey?.assertions) || journey.assertions.length === 0) errors.push(`Journey ${id} requires assertions.`);
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
    .replace(/^\s*["']use strict["'];?\s*/m, "")
    .replace(/^\s*export\s*\{\s*\};?\s*$/m, "")
    .trim();
}

export function filterExecutableChanges(files, { baseOutputs = new Map(), headOutputs = new Map() }) {
  return files.filter((file) => executableSignature(baseOutputs.get(file)) !== executableSignature(headOutputs.get(file)));
}
