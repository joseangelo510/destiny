import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareDependencyManifests, pullRequestContext } from "./governance-policy.mjs";
import { checkPayload, evaluateReadiness } from "./governance-readiness.mjs";

export async function refreshGovernance({ mode, number, repository, api, detailsUrl, loadContext = pullRequestContext }) {
  // Read current GitHub state, never an old event payload. Do not execute PR files.
  const pr = await api(`/pulls/${number}`);
  if (pr.state !== "open" || pr.base.repo.full_name !== repository.full_name) return;
  const head = pr.head.sha;
  const pending = checkPayload(mode, head, { state: "waiting", reasons: ["Refreshing current PR evidence and approval."] }, detailsUrl);
  const check = await api("/check-runs", "POST", pending);
  const context = await loadContext({ repository, pull_request: pr });
  const snapshot = JSON.stringify(context);
  const packagePath = "destiny-product/package.json";
  if (mode === "policy" && context.files.includes(packagePath)) {
    const manifests = await Promise.all([pr.base.sha, head].map(async (ref) => {
      const value = await api(`/contents/${packagePath}?ref=${ref}`);
      if (value.encoding !== "base64" || !value.content) throw new Error("Dependency manifest unavailable; cannot approve.");
      return JSON.parse(Buffer.from(value.content, "base64").toString("utf8"));
    }));
    context.dependencyDecision = compareDependencyManifests(...manifests);
  }
  if (mode === "checklist") context.runs = await api(`/actions/runs?head_sha=${head}&event=pull_request`, "PAGES_RUNS");
  const result = evaluateReadiness(mode, { ...context, draft: pr.draft });
  const latestContext = await loadContext({ repository, pull_request: pr });
  if (snapshot !== JSON.stringify(latestContext)) return;
  const fresh = await api(`/pulls/${number}`);
  // Edits or pushes during API reads cannot turn the older snapshot green.
  if (fresh.state !== "open" || fresh.head.sha !== head || fresh.base.sha !== pr.base.sha || fresh.updated_at !== pr.updated_at || fresh.body !== pr.body || JSON.stringify(fresh.labels) !== JSON.stringify(pr.labels) || fresh.draft !== pr.draft) return;
  const { head_sha: ignoredHead, ...payload } = checkPayload(mode, head, result, detailsUrl);
  void ignoredHead;
  await api(`/check-runs/${check.id}`, "PATCH", payload);
  if (result.state === "failure") throw new Error(result.reasons.join("; "));
  process.stdout.write(`PR #${number} ${mode}: ${result.state}\n${result.reasons.join("\n")}\n`);
}

async function main() {
  const mode = process.argv[2];
  if (!["policy", "checklist"].includes(mode)) throw new Error("Expected policy or checklist.");
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const repository = event.repository;
  if (repository?.full_name !== "joseangelo510/destiny") throw new Error("Unexpected repository.");
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN required.");
  const api = async (route, method = "GET", body) => {
    if (method === "PAGES_RUNS" || method === "PAGES") {
      const items = [];
      for (let page = 1; page <= 100; page += 1) {
        const data = await api(`${route}${route.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
        const batch = method === "PAGES_RUNS" ? data.workflow_runs : data;
        items.push(...batch);
        if (batch.length < 100) return items;
      }
      throw new Error("Pagination exhausted; cannot approve from partial data.");
    }
    const response = await fetch(`${repository.url}${route}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status} on ${method} ${route}`);
    return response.json();
  };
  let numbers = [];
  if (event.pull_request) numbers = [event.pull_request.number];
  else if (event.issue?.pull_request) numbers = [event.issue.number];
  else if (event.inputs?.pr_number) {
    if (!/^[1-9]\d*$/.test(String(event.inputs.pr_number))) throw new Error("Invalid PR number.");
    numbers = [Number(event.inputs.pr_number)];
  } else if (event.workflow_run?.head_sha) {
    const prs = await api("/pulls?state=open", "PAGES");
    numbers = prs.filter((pr) => pr.head.sha === event.workflow_run.head_sha).map((pr) => pr.number);
  }
  const detailsUrl = `https://github.com/${repository.full_name}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  for (const number of numbers) await refreshGovernance({ mode, number, repository, api, detailsUrl });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
