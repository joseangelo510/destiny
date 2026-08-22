import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLoopbackSupabaseUrl, parseSupabaseStatus } from "./qa-isolation-environment.mjs";

export const ISOLATION_TABLES = [
  "websites",
  "audits",
  "keyword_decisions",
  "article_drafts",
  "publishing_plans",
  "publishing_schedule_items",
  "interviews",
  "interlink_runs",
  "notifications",
];

const productRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const auditSql = path.join(productRoot, "qa", "sql", "site-isolation-audit.sql");
const rlsPolicyAuditSql = path.join(productRoot, "qa", "sql", "rls-policy-audit.sql");
const supabaseBin = path.join(productRoot, "node_modules", ".bin", "supabase");
const vitestBin = path.join(productRoot, "node_modules", ".bin", "vitest");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: productRoot,
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const status = parseSupabaseStatus(run(supabaseBin, ["status", "-o", "json"]));
assertLoopbackSupabaseUrl(status.apiUrl);

const result = spawnSync(vitestBin, ["run", "--config", "vitest.isolation.config.mjs"], {
  cwd: productRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    QA_ISOLATION: "1",
    QA_SUPABASE_URL: status.apiUrl,
    QA_SUPABASE_ANON_KEY: status.anonKey,
    QA_SUPABASE_SERVICE_ROLE_KEY: status.serviceRoleKey,
    QA_DATABASE_URL: status.databaseUrl,
    QA_ISOLATION_AUDIT_SQL: auditSql,
    QA_RLS_POLICY_AUDIT_SQL: rlsPolicyAuditSql,
  },
});

process.exit(result.status ?? 1);
