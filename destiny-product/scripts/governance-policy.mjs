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

const OWNER_LABELS = ["cto-approved", "policy-change"];
const OEA_PATTERN = /\bOEA\s+#(\d+)\s+([0-9a-f]{40})\s*:\s*([a-z-]+(?:\s*,\s*[a-z-]+)*)/i;
const OEA_ACTIONS = new Set(["cto-approved", "policy-change", "merge"]);
const OEA_WINDOW_MS = 60 * 60 * 1000;

export function parseOwnerExecutionAuthorization(text = "", { prNumber, headSha } = {}) {
  const match = String(text).match(OEA_PATTERN);
  if (!match) return { ok: false, errors: ["No OEA found. Expected: OEA #<pr> <40-char head>: <actions>."] };
  const errors = [];
  const number = Number(match[1]);
  const head = match[2].toLowerCase();
  const actions = match[3].split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  for (const action of actions) if (!OEA_ACTIONS.has(action)) errors.push(`Unknown OEA action: ${action}.`);
  if (prNumber !== undefined && number !== Number(prNumber)) errors.push(`OEA names PR #${number}, not PR #${prNumber}.`);
  if (headSha && head !== String(headSha).toLowerCase()) errors.push(`OEA names head ${head}, not the PR head ${String(headSha).toLowerCase()}.`);
  return { ok: errors.length === 0, number, head, actions, errors };
}

function recordField(body, label) {
  return body.match(new RegExp(`^[ \\t]*-[ \\t]*${label}:[ \\t]*([^\\r\\n]+?)[ \\t]*$`, "im"))?.[1] ?? "";
}

export function evaluateDelegation({ record, prNumber, headSha, labels = [], labelTimes = {} }) {
  if (!record) return { mode: "personal", errors: [] };
  const errors = [];
  const body = String(record.body ?? "");
  if (!/^\s*Owner execution authorization/i.test(body)) return { mode: "personal", errors: [] };
  if (/^\s*Owner execution authorization[^\n]*\bvoid\b/i.test(body)) return { mode: "void", errors: [] };
  if (String(record.author ?? "").toLowerCase() !== JOSE_LOGIN) errors.push("The authorization record must be posted through the verified owner's account.");
  if (!/^\s*-\s*Executed by:\s*Codex\s*$/im.test(body)) errors.push("Delegation record must state Executed by: Codex.");
  if (!/^\s*-\s*Authorized by:\s*Jose Gallegos \(joseangelo510\)/im.test(body)) errors.push("Delegation record must state Authorized by: Jose Gallegos (joseangelo510).");
  const ownerRequest = recordField(body, "Owner request");
  const ownerDirected = !recordField(body, "OEA");
  const oea = ownerDirected
    ? { ok: true, number: Number(recordField(body, "Authorized PR")), head: recordField(body, "Authorized head").toLowerCase(), actions: recordField(body, "Authorized actions").split(",").map((action) => action.trim().toLowerCase()), errors: [] }
    : parseOwnerExecutionAuthorization(recordField(body, "OEA"), { prNumber, headSha });
  if (ownerDirected) {
    if (!ownerRequest.trim()) errors.push("Delegation requires the verbatim Owner request.");
    if (!recordField(body, "Authorization source").trim()) errors.push("Delegation requires an Authorization source identifying the owner message.");
    if (!Number.isInteger(oea.number) || oea.number < 1 || (prNumber !== undefined && oea.number !== Number(prNumber))) errors.push("Authorized PR must match this PR.");
    if (!oea.actions.length || oea.actions.some((action) => !OEA_ACTIONS.has(action))) errors.push("Authorized actions must name only supported owner actions.");
  }
  errors.push(...oea.errors);
  const recordedHead = recordField(body, "Authorized head").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(recordedHead)) errors.push("Delegation record must state Authorized head as a full 40-character SHA.");
  else if (headSha && recordedHead !== String(headSha).toLowerCase()) errors.push(`Delegation record names head ${recordedHead}, not the PR head ${String(headSha).toLowerCase()}.`);
  const authorizedAt = Date.parse(recordField(body, "Authorized at"));
  if (!ownerDirected && !Number.isFinite(authorizedAt)) errors.push("Delegation record must state Authorized at as an ISO-8601 timestamp.");
  const recordedActions = recordField(body, "Authorized actions").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (oea.ok && recordedActions.join(",") !== oea.actions.join(",")) errors.push("Authorized actions must match the OEA action list exactly.");
  const postedAt = Date.parse(record.created_at ?? "");
  for (const label of labels.map((item) => item.toLowerCase())) {
    if (!OWNER_LABELS.includes(label)) continue;
    if (oea.ok && !oea.actions.includes(label)) errors.push(`Label ${label} is present but the OEA does not authorize it.`);
    const appliedAt = Date.parse(labelTimes[label] ?? "");
    if (!Number.isFinite(appliedAt)) continue;
    if (Number.isFinite(postedAt) && appliedAt < postedAt) errors.push(`Label ${label} was applied before the delegation record was posted.`);
    if (!ownerDirected && Number.isFinite(authorizedAt) && (appliedAt < authorizedAt || appliedAt - authorizedAt > OEA_WINDOW_MS)) {
      errors.push(`Label ${label} was applied outside the 60-minute OEA window.`);
    }
  }
  return { mode: "delegated", oea: oea.ok ? { number: oea.number, head: oea.head, actions: oea.actions } : null, errors: [...new Set(errors)] };
}

export function evaluatePolicyGuard({ files, labels, labelActors, dependencyDecision, delegationRecord, prNumber, headSha, labelTimes }) {
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

  const delegation = evaluateDelegation({ record: delegationRecord, prNumber, headSha, labels, labelTimes: labelTimes ?? {} });
  errors.push(...delegation.errors);

  return { classification, execution: delegation.mode, errors: [...new Set(errors)] };
}

function checked(body, label) {
  return new RegExp(`^- \\[x\\] ${label}`, "im").test(body);
}

export function evaluateTechnicalReview(body = "", headSha = "") {
  const errors = [];
  if (!checked(body, "Technical review completed at the current PR head")) {
    errors.push("Every PR requires a checked technical review item.");
  }
  if (!/^[ \t]*-[ \t]*Reviewer:[ \t]*\S[^\r\n]*$/im.test(body)) errors.push("Technical review must identify its actual reviewer.");
  const verdict = body.match(/^\s*-\s*Verdict:\s*(GO|HOLD)\b/im)?.[1]?.toUpperCase() ?? null;
  if (verdict !== "GO") errors.push("The technical review verdict must be GO before merge.");
  const reviewedHead = body.match(/^\s*-\s*Reviewed head:\s*([0-9a-f]{40})\b/im)?.[1]?.toLowerCase() ?? null;
  if (!reviewedHead) {
    errors.push("The technical review must name the reviewed head as a full 40-character SHA.");
  } else if (headSha && reviewedHead !== String(headSha).toLowerCase()) {
    errors.push(`The technical review covers ${reviewedHead}, not the PR head ${String(headSha).toLowerCase()}.`);
  }
  if (!/^\s*-\s*Reviewed on:\s*\d{4}-\d{2}-\d{2}\b/im.test(body)) {
    errors.push("The technical review must record the review date as YYYY-MM-DD.");
  }
  return { verdict, reviewedHead, errors };
}

export function evaluateChecklist(body = "", context = {}) {
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
  ]) if (!checked(body, label)) errors.push(`Missing checked evidence item: ${label}.`);

  const runUrls = body.match(runUrlPattern) ?? [];
  if (runUrls.length < 3) errors.push("Vitest, ESLint, and Playwright require GitHub Actions run URLs.");
  const headSha = context.headSha ? String(context.headSha).toLowerCase() : "";
  const stampBlock = body.match(/^- \[x\] Build stamp on staging matches this PR SHA[^\n]*\n((?:(?!^- \[)[^\n]*\n?)*)/im)?.[1] ?? "";
  const stampSha = stampBlock.match(/\b[0-9a-f]{40}\b/i)?.[0]?.toLowerCase() ?? null;
  if (!stampSha) errors.push("Build-stamp evidence must include the full 40-character PR SHA.");
  else if (headSha && stampSha !== headSha) errors.push(`Build-stamp evidence names ${stampSha}, not the PR head ${headSha}.`);
  if (!/zero 5xx/i.test(body)) errors.push("Touched-route evidence must state zero 5xx.");

  if (unique[0] === "HIGH") {
    if (!checked(body, "Frozen zone changes are authorized by the linked CTO decision")) {
      errors.push("HIGH work must confirm its frozen-zone changes are authorized by the linked CTO decision.");
    }
    if (!checked(body, "CTO decision recorded before implementation")) errors.push("HIGH work requires a checked CTO decision item.");
    if (!/destiny-product\/DEPLOY_LOG\.md(?:#[-a-z0-9]+)?/i.test(body)) errors.push("HIGH work requires a CTO decision link to destiny-product/DEPLOY_LOG.md.");
  } else if (unique[0] === "MEDIUM" && !checked(body, "Frozen zone: no frozen files or actions are touched")) {
    errors.push("MEDIUM work must confirm that no frozen files or actions are touched.");
  }

  const review = evaluateTechnicalReview(body, headSha);
  errors.push(...review.errors);

  return { classification: unique[0] ?? null, review: { verdict: review.verdict, reviewedHead: review.reviewedHead }, errors: [...new Set(errors)] };
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
  const comments = await githubPages(`${api}/issues/${number}/comments`, token);
  const labelActors = {};
  const labelTimes = {};
  for (const item of events) {
    const name = item.label?.name?.toLowerCase();
    if (item.event === "labeled" && name) {
      labelActors[name] = item.actor?.login ?? "";
      labelTimes[name] = item.created_at ?? "";
    }
    if (item.event === "unlabeled" && name) {
      delete labelActors[name];
      delete labelTimes[name];
    }
  }
  const delegationRecord = comments
    .filter((comment) => /^\s*Owner execution authorization/i.test(comment.body ?? ""))
    .map((comment) => ({ body: comment.body ?? "", created_at: comment.created_at ?? "", author: comment.user?.login ?? "" }))
    .at(-1) ?? null;

  return {
    files: files.map((file) => file.filename),
    labels: (event.pull_request.labels ?? []).map((label) => label.name),
    labelActors,
    labelTimes,
    delegationRecord,
    prNumber: number,
    body: event.pull_request.body ?? "",
    baseSha: event.pull_request.base?.sha,
    headSha: event.pull_request.head?.sha ?? "",
  };
}

async function main() {
  const command = process.argv[2];
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required.");
  const event = JSON.parse(await readFile(path.resolve(eventPath), "utf8"));
  const context = await pullRequestContext(event);

  if (command === "checklist") {
    const result = evaluateChecklist(context.body, { headSha: context.headSha });
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
