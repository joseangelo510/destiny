import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "qa", "inventory");
const sourceRoots = [path.join(root, "src", "app"), path.join(root, "src", "components")];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || / 2\.[^.]+$/.test(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function routeFromPage(file) {
  const routeFile = relative(file).replace(/^src\/app/, "");
  if (routeFile.endsWith("/page.tsx")) {
    const route = routeFile.slice(0, -"/page.tsx".length) || "/";
    return { kind: "page", route };
  }
  if (routeFile.endsWith("/route.ts")) {
    return { kind: "api", route: routeFile.slice(0, -"/route.ts".length) || "/" };
  }
  if (routeFile.endsWith("/actions.ts")) {
    return { kind: "server-actions", route: routeFile.slice(0, -"/actions.ts".length) || "/" };
  }
  return null;
}

const interactivePattern = /<(button|a|Link|input|select|textarea|form|summary)\b|on(?:Click|Submit|Change|KeyDown|KeyUp)\s*=|role\s*=\s*["'](?:button|tab|menuitem)["']|contentEditable\s*=|\.(?:insert|update|delete|rpc|upload)\s*\(/g;

function controlType(match) {
  if (match.startsWith("<")) return match.match(/^<([A-Za-z]+)/)?.[1] ?? "element";
  if (match.startsWith(".")) return "data-mutation";
  return match.split(/\s|=/)[0];
}

function sideEffectClass(context) {
  const value = context.toLowerCase();
  if (/delete account|delete website|publish|post externally|disconnect/.test(value)) return 3;
  if (/generate|run live analysis|start.*audit|send to wordpress|send.*cms|send.*email|sync now/.test(value)) return 2;
  if (/approve|decline|save|remove|reopen|mark done|track|connect|reconnect|complete|update|insert|upload/.test(value)) return 1;
  return 0;
}

function csvCell(value) {
  const string = String(value ?? "");
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

await mkdir(outputDir, { recursive: true });
const files = (await Promise.all(sourceRoots.map(walk))).flat()
  .filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.test\.(?:ts|tsx)$/.test(file));

const routes = [];
const controls = [];
for (const file of files) {
  const route = routeFromPage(file);
  if (route) routes.push({ ...route, file: relative(file) });

  const content = await readFile(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    const matches = [...line.matchAll(interactivePattern)];
    matches.forEach((match, occurrence) => {
      const start = Math.max(0, index - 1);
      const end = Math.min(lines.length, index + 2);
      const context = lines.slice(start, end).join(" ").replace(/\s+/g, " ").trim();
      const type = controlType(match[0]);
      controls.push({
        control_id: `${relative(file)}:${index + 1}:${type}:${occurrence + 1}`,
        file: relative(file),
        line: index + 1,
        type,
        route: route?.route ?? "component",
        side_effect_class: sideEffectClass(context),
        context: context.slice(0, 500),
      });
    });
  });
}

routes.sort((a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind));
controls.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const matrixColumns = [
  "test_id", "workspace", "persona", "preconditions", "route", "control_id", "action",
  "expected", "evidence_required", "side_effect_class", "cleanup", "automation_layer", "status",
  "defect_ref", "approval_ref",
];
const matrixRows = controls.map((control, index) => ({
  test_id: `CTRL.CENSUS.${String(index + 1).padStart(4, "0")}`,
  workspace: control.side_effect_class === 0 ? "SF_PROD" : "STG_DISPOSABLE",
  persona: "owner_jose",
  preconditions: "Authenticated workspace; seeded state matching the control",
  route: control.route,
  control_id: control.control_id,
  action: `Exercise ${control.type} and verify its documented behavior`,
  expected: "Expected state transition occurs once; rendered and persisted data retain the selected website provenance",
  evidence_required: control.side_effect_class === 0 ? "trace+screenshot+network" : "trace+network+database+cleanup",
  side_effect_class: control.side_effect_class,
  cleanup: control.side_effect_class === 0 ? "none" : "Restore disposable fixture",
  automation_layer: control.side_effect_class === 0 ? "e2e" : "integration+e2e",
  status: "NOT RUN",
  defect_ref: "",
  approval_ref: "",
}));

await writeFile(path.join(outputDir, "routes.json"), `${JSON.stringify(routes, null, 2)}\n`);
await writeFile(path.join(outputDir, "static-controls.json"), `${JSON.stringify(controls, null, 2)}\n`);
await writeFile(
  path.join(outputDir, "coverage-ledger.csv"),
  `${matrixColumns.join(",")}\n${matrixRows.map((row) => matrixColumns.map((column) => csvCell(row[column])).join(",")).join("\n")}\n`,
);

console.log(`QA inventory: ${routes.length} routes, ${controls.length} interactive or mutation surfaces.`);
