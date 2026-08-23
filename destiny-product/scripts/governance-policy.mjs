import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JOSE_LOGIN = "joseangelo510";
const runUrlPattern = /https:\/\/github\.com\/joseangelo510\/destiny\/actions\/runs\/\d+/gi;

const frozenRules = [
  [/^HARNESS_POLICY\.md$/, "canonical harness policy"],
  [/^(?:AGENTS|CLAUDE)\.md$/, "agent governance pointer"],
  [/^\.claude\/skills\/destiny-harness\//, "Claude governance skill"],
  [/^docs\/(?:HARNESS_RUNBOOK|DESTINY_GOVERNANCE_POINTER)\.md$/, "governance knowledge"],
  [/^\.github\/(?:workflows|scripts)\//, "CI or enforcement workflow"],
  [/^destiny-product\/scripts\/governance-policy\.mjs$/, "governance enforcement code"],
  [/^destiny-product\/qa\/rules\/harness-governance\.test\.ts$/, "governance enforcement test"],
  [/^destiny-product\/supabase\/migrations\//, "database migration"],
  [/^destiny-product\/supabase\/config\.toml$/, "Supabase configuration"],
  [/^destiny-product\/supabase\/functions\/(?:delete-account|google-oauth[^/]*)\//, "authentication or security function"],
  [/^destiny-product\/(?:src|qa)\/.*(?:auth|oauth|rls|session|security)[^/]*\//i, "authentication, RLS, session, or security code"],
  [/^destiny-product\/src\/lib\/supabase\//, "Supabase access boundary"],
  [/^(?:production\/run\.json|Dockerfile|fly\.toml)$/, "release wrapper or production runtime"],
];

const sensitiveDependency = /(?:^|[-/@])(auth|oauth|jwt|jose|crypto|bcrypt|argon|payment|stripe|session|supabase)(?:$|[-/])/i;

function normalized(file) {
  return String(file).replaceAll("\\", "/").replace(/^\.\//, "");
}

export function classifyGovernanceChange(files, dependencyDecision = { high: false, reasons: [] }) {
  const reasons = [];
  for (const raw of files) {
    const file = normalized(raw);
    for (const [pattern, reason] of frozenRules) {
      if (pattern.test(file)) reasons.push(`${file}: ${reason}`);
    }
  }
  reasons.push(...(dependencyDecision.reasons ?? []));
  return { level: reasons.length || dependencyDecision.high ? "HIGH" : "MEDIUM", reasons: [...new Set(reasons)] };
}

function major(version) {
  const match = String(version ?? "").match(/(?:^|npm:)[~^<>= ]*(\d+)/);
  return match ? Number(match[1]) : null;
}

export function compareDependencyManifests(base, head) {
  const reasons = [];
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const before = base?.[field] ?? {};
    const after = head?.[field] ?? {};
    const names = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const name of names) {
      if (before[name] === after[name]) continue;
      if (sensitiveDependency.test(name)) {
        reasons.push(`${name}: security-sensitive dependency change`);
        continue;
      }
      if (!(name in before) || !(name in after)) {
        reasons.push(`${name}: runtime dependency added or removed`);
        continue;
      }
      const oldMajor = major(before[name]);
      const newMajor = major(after[name]);
      if (oldMajor === null || newMajor === null || oldMajor !== newMajor) {
        reasons.push(`${name}: dependency major or unclassifiable version change`);
      }
    }
  }
  return { high: reasons.length > 0, reasons };
}

export function evaluatePolicyGuard({ files, labels, labelActors, dependencyDecision }) {
  const classification = classifyGovernanceChange(files, dependencyDecision);
  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  const actors = Object.fromEntries(Object.entries(labelActors).map(([key, value]) => [key.toLowerCase(), String(value).toLowerCase()]));
  const errors = [];

  if (classification.level === "HIGH") {
    if (!normalizedLabels.has("cto-approved")) errors.push("HIGH changes require the cto-approved label.");
    else if (actors["cto-approved"] !== JOSE_LOGIN) errors.push(`cto-approved must be applied by ${JOSE_LOGIN}.`);
  }

  if (files.map(normalized).includes("HARNESS_POLICY.md")) {
    if (!normalizedLabels.has("policy-change")) errors.push("HARNESS_POLICY.md requires the policy-change label.");
    else if (actors["policy-change"] !== JOSE_LOGIN) errors.push(`policy-change must be applied by ${JOSE_LOGIN}.`);
  }

  return { classification, errors };
}

function checked(body, label) {
  return new RegExp(`^- \\[x\\] ${label}`, "im").test(body);
}

export function evaluateChecklist(body = "") {
  const errors = [];
  const classifications = [...body.matchAll(/^- \[x\] Classification:\s*(MEDIUM|HIGH)\s*$/gim)].map((match) => match[1].toUpperCase());
  const unique = [...new Set(classifications)];
  if (unique.length !== 1) errors.push("Select exactly one checked Classification: MEDIUM or HIGH.");
  if (/^- \[ \]/m.test(body)) errors.push("The PR checklist contains an unchecked item.");

  for (const label of [
    "Vitest full suite green",
    "ESLint, English-only rule, and file-length ratchet green",
    "Playwright journeys green",
    "Build stamp on staging matches this PR SHA",
    "Touched staging routes checked with zero 5xx",
    "Frozen zone: no frozen files or actions are touched",
  ]) if (!checked(body, label)) errors.push(`Missing checked evidence item: ${label}.`);

  const runUrls = body.match(runUrlPattern) ?? [];
  if (runUrls.length < 3) errors.push("Vitest, ESLint, and Playwright require GitHub Actions run URLs.");
  if (!/\b[0-9a-f]{40}\b/i.test(body)) errors.push("Build-stamp evidence must include the full 40-character PR SHA.");
  if (!/zero 5xx/i.test(body)) errors.push("Touched-route evidence must state zero 5xx.");

  if (unique[0] === "HIGH") {
    if (!checked(body, "CTO decision recorded before implementation")) errors.push("HIGH work requires a checked CTO decision item.");
    if (!/destiny-product\/DEPLOY_LOG\.md(?:#[-a-z0-9]+)?/i.test(body)) errors.push("HIGH work requires a CTO decision link to destiny-product/DEPLOY_LOG.md.");
  }

  return { classification: unique[0] ?? null, errors: [...new Set(errors)] };
}

function gitShowJson(sha, file) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${sha}:${file}`], { encoding: "utf8" }));
  } catch {
    return null;
  }
}

async function githubPages(url, token) {
  const values = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}per_page=100&page=${page}`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
    const batch = await response.json();
    values.push(...batch);
    if (batch.length < 100) break;
  }
  return values;
}

async function pullRequestContext(event) {
  const repository = event.repository?.full_name;
  const number = event.pull_request?.number;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !number || !token) throw new Error("Missing pull-request repository, number, or GITHUB_TOKEN.");

  const api = event.repository.url;
  const files = await githubPages(`${api}/pulls/${number}/files`, token);
  const events = await githubPages(`${api}/issues/${number}/events`, token);
  const labelActors = {};
  for (const item of events) {
    const name = item.label?.name?.toLowerCase();
    if (item.event === "labeled" && name) labelActors[name] = item.actor?.login ?? "";
    if (item.event === "unlabeled" && name) delete labelActors[name];
  }

  return {
    files: files.map((file) => file.filename),
    labels: (event.pull_request.labels ?? []).map((label) => label.name),
    labelActors,
    body: event.pull_request.body ?? "",
    baseSha: event.pull_request.base?.sha,
  };
}

async function main() {
  const command = process.argv[2];
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required.");
  const event = JSON.parse(await readFile(path.resolve(eventPath), "utf8"));
  const context = await pullRequestContext(event);

  if (command === "checklist") {
    const result = evaluateChecklist(context.body);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.errors.length) process.exitCode = 1;
    return;
  }

  if (command === "policy") {
    const packagePath = "destiny-product/package.json";
    const dependencyDecision = context.files.includes(packagePath)
      ? compareDependencyManifests(gitShowJson(context.baseSha, packagePath), JSON.parse(await readFile(packagePath, "utf8")))
      : { high: false, reasons: [] };
    const result = evaluatePolicyGuard({ ...context, dependencyDecision });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.errors.length) process.exitCode = 1;
    return;
  }

  throw new Error("Expected governance command: policy or checklist.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
