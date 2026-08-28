const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

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
