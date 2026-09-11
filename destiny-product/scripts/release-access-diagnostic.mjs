import path from "node:path";
import { fileURLToPath } from "node:url";

const endpoints = [
  "https://api.github.com/rate_limit",
  "https://api.github.com/repos/joseangelo510/destiny/pulls?state=open&per_page=1",
];
const safeHeaders = ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-used", "x-ratelimit-reset", "x-ratelimit-resource", "retry-after", "x-github-request-id"];

// A diagnostic only: no retries, pagination, writes or required-check reporting.
export async function diagnoseGitHubAccess({ token, fetchImpl = fetch }) {
  if (!token) throw new Error("GITHUB_TOKEN required");
  const sanitize = (value) => typeof value === "string" ? value.split(token).join("[REDACTED]").replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 600) : undefined;
  const results = [];
  for (const endpoint of endpoints) {
    const result = { endpoint, observedAt: new Date().toISOString() };
    try {
      const response = await fetchImpl(endpoint, {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      });
      result.status = response.status;
      result.headers = {};
      for (const name of safeHeaders) {
        const value = response.headers.get(name);
        if (value !== null) result.headers[name] = sanitize(value);
      }
      try {
        const body = await response.json();
        if (endpoint === endpoints[0] && body?.resources?.core) {
          result.core = {};
          for (const key of ["limit", "remaining", "used", "reset"]) {
            const value = body.resources.core[key];
            if (Number.isSafeInteger(value) && value >= 0) result.core[key] = value;
          }
        }
        if (!response.ok) {
          result.message = sanitize(body?.message);
          result.documentation_url = sanitize(body?.documentation_url);
        }
      } catch { result.error = "Response was not JSON"; }
    } catch { result.error = "Request failed or timed out"; }
    results.push(result);
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(await diagnoseGitHubAccess({ token: process.env.GITHUB_TOKEN }), null, 2)}\n`);
}
